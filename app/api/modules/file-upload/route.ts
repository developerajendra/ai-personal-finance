import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Transaction } from "@/shared/types";
import { analyzeExcelData, ExcelAnalysisResult } from "@/server/imports/excelAnalyzer";
import { generateCacheKey, saveToCache, loadFromCache } from "@/server/imports/analysisCache";
import { importPortfolio, type PortfolioImportResult } from "@/server/imports/portfolioImport";
import { isPortfolioWorkbook, importPortfolioWorkbook } from "@/server/imports/workbookImport";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    // Check if this is a Google Drive upload (JSON body) or direct file upload (FormData)
    const contentType = request.headers.get("content-type") || "";

    let data: any[];
    let source = "file";
    let cachedData = null;
    let fileInfoForCache: { name: string; buffer: Buffer } | null = null;

    if (contentType.includes("application/json")) {
      // Google Drive upload
      const body = await request.json();
      data = body.fileData || [];
      source = body.source || "google-drive";

      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: "No file data provided" },
          { status: 400 }
        );
      }
    } else {
      // Direct file upload
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const bufferNode = Buffer.from(buffer);
      fileInfoForCache = { name: file.name, buffer: bufferNode };

      // Portfolio workbooks (multi-sheet export) have known columns:
      // import every sheet directly instead of guessing with AI.
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        if (isPortfolioWorkbook(workbook)) {
          const result = await importPortfolioWorkbook(userId, workbook);
          const added = newlyCreatedCount(result);
          return NextResponse.json({
            success: true,
            transactions: [],
            count: result.transactions.inserted,
            portfolioItems: { ...result.totals, newlyCreated: added },
            importSummary: result,
            aiAnalysisSuccess: true,
            aiError: null,
            validDataRows: 0,
            cached: false,
            workbook: true,
            message:
              `Imported portfolio workbook: ${result.added.investments} investments, ${result.added.bankBalances} bank balances & receivables, ` +
              `${result.added.loans} loans, ${result.added.properties} properties, ${result.transactions.inserted} transactions ` +
              `(${result.transactions.skipped} already imported), ${result.holdings.stocks} stocks, ${result.holdings.mutualFunds} mutual funds and ` +
              `${result.holdings.ppfAccounts} provident fund accounts. Records that already existed were kept.` +
              (result.rejected.length ? ` ${result.rejected.length} rows were skipped as invalid.` : ""),
          });
        }
      }

      // Check for cache bypass query parameter
      const url = new URL(request.url);
      const bypassCache = url.searchParams.get("bypassCache") === "true" || url.searchParams.get("force") === "true";

      // Check cache first (unless bypassed)
      const cacheKey = generateCacheKey(file.name, bufferNode);

      if (bypassCache) {
        console.log(`\nCACHE BYPASSED - Will call Ollama for fresh analysis`);
        console.log(`   (bypassCache=true query parameter detected)\n`);
        cachedData = null;
      } else {
        console.log(`Checking cache for file: ${file.name}...`);
        cachedData = await loadFromCache(cacheKey);

        if (cachedData) {
          console.log(`\n`);
          console.log(`CACHE HIT - SKIPPING OLLAMA CALL`);
          console.log(`File: ${file.name}`);
          console.log(`Using cached data. Found:`);
          console.log(`   - ${cachedData.portfolioItems?.investments?.length || 0} investments`);
          console.log(`   - ${cachedData.portfolioItems?.loans?.length || 0} loans`);
          console.log(`   - ${cachedData.portfolioItems?.properties?.length || 0} properties`);
          console.log(`   - ${cachedData.portfolioItems?.bankBalances?.length || 0} bank balances`);
          console.log(`\nTo force fresh AI analysis, add ?bypassCache=true to the upload URL`);
          console.log(`   or rename the file to create a new cache key\n`);

          // Merge cached items: existing records are kept, duplicates skipped.
          const result = await importPortfolio(userId, cachedData.portfolioItems ?? {}, {
            source: "excel",
            rows: cachedData.transactions || [],
          });

          return NextResponse.json({
            success: true,
            transactions: cachedData.transactions || [],
            count: cachedData.transactions?.length || 0,
            portfolioItems: { ...result.totals, newlyCreated: newlyCreatedCount(result) },
            importSummary: result,
            aiAnalysisSuccess: true,
            aiError: null,
            validDataRows: cachedData.parsedData?.length || 0,
            cached: true,
            message: `Loaded ${file.name} from cache. Added ${newlyCreatedCount(result)} new portfolio items and ${result.transactions.inserted} new transactions (${result.transactions.skipped} already imported). Existing records were kept. To force fresh AI analysis, add ?bypassCache=true to the URL.`,
          });
        }
      }

      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Read as JSON with header row
      data = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false,
      });
    }


    console.log("Excel data parsed - Total rows:", data.length);
    console.log("First 3 rows:", JSON.stringify(data.slice(0, 3), null, 2));
    console.log("Column names:", data.length > 0 ? Object.keys(data[0]) : []);

    // Filter out completely empty rows
    const validData = data.filter((row: any) => {
      const entity = row.Entity || row.entity || row["Entity"];
      return entity && entity.toString().trim() !== "";
    });

    console.log("Valid data rows after filtering:", validData.length);

    // Parse transactions from Excel data
    // Handle different Excel structures
    const transactions: Transaction[] = data
      .filter((row: any) => {
        // Filter out empty rows or rows without entity/name
        const entity = row.Entity || row.entity || row.Name || row.name || row["Entity"];
        return entity && typeof entity === "string" && entity.trim() !== "";
      })
      .map((row: any, index: number) => {
        // Handle different column name variations
        const entity = row.Entity || row.entity || row.Name || row.name || "";
        const debitIC = parseFloat(row["Debit IC"] || row["Debit IC"] || row.debitIC || 0) || 0;
        const debitNC = parseFloat(row["Debit NC"] || row["Debit NC"] || row.debitNC || 0) || 0;
        const credit = parseFloat(row.Credit || row.credit || 0) || 0;
        const amount = debitIC + debitNC + credit;
        const ytdValue = parseFloat(row["YTD Value"] || row.ytdValue || row["YTD Value"] || 0) || 0;
        const remarks = row.Remarks || row.remarks || "";

        // Parse dates
        let startDate = row["Start Date"] || row.startDate || row["Start Date"];
        let maturityDate = row["Maturity Date"] || row.maturityDate || row["Maturity Date"];

        // Convert Excel date numbers to ISO strings if needed
        if (typeof startDate === "number") {
          // Excel date serial number - convert to date
          try {
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + startDate * 86400000);
            startDate = date.toISOString();
          } catch {
            // If it's just a year (like 2022), convert to date
            if (startDate > 1900 && startDate < 2100) {
              startDate = new Date(startDate, 0, 1).toISOString();
            } else {
              startDate = new Date().toISOString();
            }
          }
        } else if (startDate && typeof startDate === "string") {
          // Try to parse string dates
          const parsed = new Date(startDate);
          startDate = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        } else {
          startDate = new Date().toISOString();
        }

        if (typeof maturityDate === "number") {
          try {
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + maturityDate * 86400000);
            maturityDate = date.toISOString();
          } catch {
            // If it's just a year (like 2034), convert to date
            if (maturityDate > 1900 && maturityDate < 2100) {
              maturityDate = new Date(maturityDate, 0, 1).toISOString();
            } else {
              maturityDate = undefined;
            }
          }
        } else if (maturityDate && typeof maturityDate === "string") {
          const parsed = new Date(maturityDate);
          maturityDate = isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
        }

        const type = amount > 0 ? "credit" : "debit";
        const category = entity.toLowerCase().includes("loan") ? "loan" :
          entity.toLowerCase().includes("ppf") ? "investment" :
            entity.toLowerCase().includes("pf") ? "investment" :
              "uncategorized";

        return {
          id: `excel-${Date.now()}-${index}`,
          date: startDate,
          amount: Math.abs(amount) || Math.abs(ytdValue) || 0,
          description: `${entity}${remarks ? ` - ${remarks}` : ""}`,
          category,
          type,
          source: "excel" as const,
          qualityGrade: "B" as const,
        };
      });

    // Use Gemini AI to analyze Excel data and extract portfolio items
    let portfolioItems: ExcelAnalysisResult = { investments: [], loans: [], properties: [], bankBalances: [] };
    let aiAnalysisSuccess = false;
    let aiError = null;

    try {
      console.log("\n");
      console.log("FILE UPLOAD API - STARTING AI ANALYSIS");
      console.log("File upload route: Starting AI analysis of Excel data...");
      console.log(`Valid data rows: ${validData.length}`);
      console.log("Sample valid row:", JSON.stringify(validData[0], null, 2));
      console.log("\n");

      // Clean and prepare data for AI - remove empty columns
      const cleanedData = validData.map((row: any) => {
        const cleaned: any = {};
        Object.keys(row).forEach(key => {
          // Skip empty columns
          if (!key.startsWith('__EMPTY') && row[key] !== null && row[key] !== undefined && row[key] !== '') {
            cleaned[key] = row[key];
          }
        });
        return cleaned;
      });

      console.log("Cleaned data sample:", JSON.stringify(cleanedData[0], null, 2));

      // Send only valid, cleaned data to AI
      portfolioItems = await analyzeExcelData(cleanedData);

      console.log("AI analysis result:", {
        investments: portfolioItems.investments.length,
        loans: portfolioItems.loans.length,
        properties: portfolioItems.properties.length,
        bankBalances: portfolioItems.bankBalances.length,
      });

      if (portfolioItems.investments.length > 0) {
        console.log("Sample investment:", portfolioItems.investments[0]);
      }
      if (portfolioItems.loans.length > 0) {
        console.log("Sample loan:", portfolioItems.loans[0]);
      }
      if (portfolioItems.properties.length > 0) {
        console.log("Sample property:", portfolioItems.properties[0]);
      }

      aiAnalysisSuccess = true;
    } catch (error: any) {
      aiError = error;
      console.error("AI analysis error:", error);
      console.error("Error details:", error.message);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
      // Continue even if AI analysis fails
    }

    // Save to cache for future use (only if not from cache)
    if (source === "file" && !cachedData && fileInfoForCache) {
      const cacheKey = generateCacheKey(fileInfoForCache.name, fileInfoForCache.buffer);
      await saveToCache(cacheKey, {
        parsedData: validData,
        portfolioItems,
        transactions,
        metadata: {
          filename: fileInfoForCache.name,
          uploadedAt: new Date().toISOString(),
          rowCount: validData.length,
        },
      });
      console.log(`Saved to cache for future use: ${fileInfoForCache.name}`);
    }

    // Add only new records; existing data is never deleted or overwritten,
    // and re-importing the same rows is a no-op. Commits atomically.
    const result: PortfolioImportResult = await importPortfolio(userId, portfolioItems, {
      source: source === "file" ? "excel" : "google-drive",
      rows: transactions,
    });
    const newlyCreated = newlyCreatedCount(result);
    const { totals } = result;
    const totalPortfolioItems = totals.investments + totals.loans + totals.properties + totals.bankBalances;

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
      portfolioItems: { ...totals, newlyCreated },
      importSummary: result,
      aiAnalysisSuccess,
      aiError: aiError ? aiError.message : null,
      validDataRows: validData.length,
      cached: false,
      message: totalPortfolioItems > 0
        ? `Processed ${transactions.length} transactions (${result.transactions.inserted} new, ${result.transactions.skipped} already imported). AI created ${newlyCreated} new portfolio items (${totals.investments} total investments, ${totals.loans} total loans, ${totals.properties} total properties, ${totals.bankBalances} total bank balances). Check the Portfolio tab!`
        : aiError
          ? `Processed ${transactions.length} transactions. AI analysis failed: ${aiError.message}. Check server logs for details.`
          : `Processed ${transactions.length} transactions. No portfolio items detected. Found ${validData.length} valid data rows.`,
    });
  } catch (error) {
    return errorResponse(error, "Failed to process file");
  }
}

function newlyCreatedCount(result: PortfolioImportResult): number {
  const { added } = result;
  return added.investments + added.loans + added.properties + added.bankBalances;
}
