import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { generateJsonContent } from "@/core/services/ollamaService";
import {
  savePPFAccount,
  PPFAccount,
} from "@/core/services/ppfStorageService";
import { getSession } from "@/core/auth/getSession";
import fs from "fs";
import path from "path";

const PF_DATA_DIR = path.join(process.cwd(), "data", "pfData");

// Ensure pfData directory exists
function ensurePfDataDir() {
  if (!fs.existsSync(PF_DATA_DIR)) {
    fs.mkdirSync(PF_DATA_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    ensurePfDataDir();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported for PPF upload" },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();
    const bufferNode = Buffer.from(buffer);

    // Save PDF file to pfData directory
    const pdfPath = path.join(PF_DATA_DIR, file.name);
    fs.writeFileSync(pdfPath, bufferNode);
    console.log(`📄 Saved PDF file: ${pdfPath}`);

    // Extract text from PDF
    let pdfText: string;
    try {
      const pdfData = await pdfParse(bufferNode);
      pdfText = pdfData.text;
      console.log(`📖 Extracted ${pdfText.length} characters from PDF`);
    } catch (error) {
      console.error("Error parsing PDF:", error);
      return NextResponse.json(
        { error: "Failed to parse PDF file" },
        { status: 500 }
      );
    }

    // Parse the PDF text directly to extract values
    let extractedData: any = {
      memberId: null,
      memberName: null,
      establishmentId: null,
      establishmentName: null,
      depositEmployeeShare: 0,
      depositEmployerShare: 0,
      withdrawEmployeeShare: 0,
      withdrawEmployerShare: 0,
      pensionContribution: 0,
      grandTotal: 0,
    };

    try {
      // Extract Member Id and Name
      const memberMatch = pdfText.match(/Member Id \/ Name[^\n]*\n[^\n]*\n([A-Z0-9\/]+)\/\s*([^\n]+)/);
      if (memberMatch) {
        extractedData.memberId = memberMatch[1]?.trim() || null;
        extractedData.memberName = memberMatch[2]?.trim() || null;
      }

      // Extract Establishment Id and Name
      const establishmentMatch = pdfText.match(/Establishment Id \/ Name[^\n]*\n[^\n]*\n([A-Z0-9\/]+)\/?\s*([^\n]+)/);
      if (establishmentMatch) {
        extractedData.establishmentId = establishmentMatch[1]?.trim() || null;
        extractedData.establishmentName = establishmentMatch[2]?.trim() || null;
      }

      // Extract Employee Share and Employer Share from the header (these are the deposit values)
      const employeeShareMatch = pdfText.match(/Employee Share[^\n]*\n[^\n]*\n(\d+)/);
      const employerShareMatch = pdfText.match(/Employer Share[^\n]*\n[^\n]*\n(\d+)/);

      if (employeeShareMatch) {
        extractedData.depositEmployeeShare = parseInt(employeeShareMatch[1]) || 0;
      }
      if (employerShareMatch) {
        extractedData.depositEmployerShare = parseInt(employerShareMatch[1]) || 0;
      }

      // Find Grand Total line - there might be multiple, find the one that matches this establishment
      // Look for Grand Total that appears after the establishment info and matches the deposit values
      const establishmentIndex = pdfText.indexOf(extractedData.establishmentName || extractedData.establishmentId || '');
      const searchStart = establishmentIndex > 0 ? establishmentIndex : 0;
      const textAfterEstablishment = pdfText.substring(searchStart);

      // Find all Grand Total lines and find the one that matches our deposit values
      const allGrandTotals = Array.from(textAfterEstablishment.matchAll(/Grand Total\s*(\d+)/g));
      let grandTotalMatch = null;

      if (extractedData.depositEmployeeShare > 0 && extractedData.depositEmployerShare > 0) {
        const empStr = extractedData.depositEmployeeShare.toString();
        const empShareStr = extractedData.depositEmployerShare.toString();

        // Find the Grand Total that starts with our deposit values
        for (const match of allGrandTotals) {
          const allNumbers = match[1];
          if (allNumbers.startsWith(empStr)) {
            const afterEmp = allNumbers.substring(empStr.length);
            if (afterEmp.startsWith(empShareStr)) {
              grandTotalMatch = match;
              break;
            }
          }
        }
      }

      if (grandTotalMatch && extractedData.depositEmployeeShare > 0 && extractedData.depositEmployerShare > 0) {
        const allNumbers = grandTotalMatch[1];
        const empStr = extractedData.depositEmployeeShare.toString();
        const empShareStr = extractedData.depositEmployerShare.toString();

        // Find where deposit values appear in the concatenated string
        if (allNumbers.startsWith(empStr)) {
          const afterEmp = allNumbers.substring(empStr.length);

          if (afterEmp.startsWith(empShareStr)) {
            const afterEmpShare = afterEmp.substring(empShareStr.length);

            // Pattern analysis from actual data:
            // "00108709" (8 digits) = 00 (withdraw emp, 2) + 108709 (pension, 6)
            // "0042319" (7 digits) = 00 (withdraw emp, 2) + 42319 (pension, 5)
            // So format is: withdrawEmployee (2 digits) + pension (4-6 digits)
            // Withdraw employer might be missing or combined

            if (afterEmpShare.length >= 4) {
              let pensionFound = false;

              // Try pension lengths from 6 down to 4 (longer first)
              for (let pensionLen = 6; pensionLen >= 4 && !pensionFound; pensionLen--) {
                if (afterEmpShare.length >= pensionLen + 2) { // At least 2 digits for withdraw + pension
                  const pensionPart = afterEmpShare.slice(-pensionLen);
                  const withdrawPart = afterEmpShare.slice(0, -pensionLen);

                  const pension = parseInt(pensionPart);
                  // Validate pension is reasonable
                  if (pension > 0 && pension < 10000000) {
                    // Parse withdraw part
                    if (withdrawPart.length === 2) {
                      // Single withdraw value (withdraw employee only, employer is 0 or missing)
                      extractedData.withdrawEmployeeShare = parseInt(withdrawPart) || 0;
                      extractedData.withdrawEmployerShare = 0; // Not in Grand Total, assume 0
                      extractedData.pensionContribution = pension;
                      pensionFound = true;
                      console.log(`✅ Found: withdrawEmployee=${withdrawPart}, pension=${pension}`);
                    } else if (withdrawPart.length === 4) {
                      // Two withdraw values (2 digits each)
                      extractedData.withdrawEmployeeShare = parseInt(withdrawPart.substring(0, 2)) || 0;
                      extractedData.withdrawEmployerShare = parseInt(withdrawPart.substring(2)) || 0;
                      extractedData.pensionContribution = pension;
                      pensionFound = true;
                    }
                  }
                }
              }

              // If still not found, try fallback: assume last 4-6 digits are pension
              if (!pensionFound && afterEmpShare.length >= 4) {
                // Try different pension lengths
                for (let pensionLen = 6; pensionLen >= 4 && !pensionFound; pensionLen--) {
                  if (afterEmpShare.length >= pensionLen + 2) {
                    const pensionPart = afterEmpShare.slice(-pensionLen);
                    const withdrawPart = afterEmpShare.slice(0, -pensionLen);
                    const pension = parseInt(pensionPart);

                    if (pension > 0 && pension < 10000000) {
                      if (withdrawPart.length === 2) {
                        extractedData.withdrawEmployeeShare = parseInt(withdrawPart) || 0;
                        extractedData.withdrawEmployerShare = parseInt(withdrawPart) || 0;
                        extractedData.pensionContribution = pension;
                        pensionFound = true;
                      } else if (withdrawPart.length === 4) {
                        extractedData.withdrawEmployeeShare = parseInt(withdrawPart.substring(0, 2)) || 0;
                        extractedData.withdrawEmployerShare = parseInt(withdrawPart.substring(2)) || 0;
                        extractedData.pensionContribution = pension;
                        pensionFound = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Calculate grand total (sum of all positive values minus withdrawals)
      extractedData.grandTotal =
        extractedData.depositEmployeeShare +
        extractedData.depositEmployerShare -
        extractedData.withdrawEmployeeShare -
        extractedData.withdrawEmployerShare +
        extractedData.pensionContribution;

      console.log("✅ Parsed PPF data:", JSON.stringify(extractedData, null, 2));
    } catch (error) {
      console.error("Error parsing PPF data:", error);
      // Keep default values
    }

    // Create PPF account object
    const accountId = `ppf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ppfAccount: PPFAccount = {
      id: accountId,
      memberId: extractedData.memberId || null,
      memberName: extractedData.memberName || null,
      establishmentId: extractedData.establishmentId || null,
      establishmentName: extractedData.establishmentName || null,
      depositEmployeeShare: extractedData.depositEmployeeShare || 0,
      depositEmployerShare: extractedData.depositEmployerShare || 0,
      withdrawEmployeeShare: extractedData.withdrawEmployeeShare || 0,
      withdrawEmployerShare: extractedData.withdrawEmployerShare || 0,
      pensionContribution: extractedData.pensionContribution || 0,
      grandTotal: extractedData.grandTotal || 0,
      extractedFrom: file.name,
      extractedAt: new Date().toISOString(),
      rawData: extractedData,
    };

    await savePPFAccount(userId, ppfAccount);

    return NextResponse.json({
      success: true,
      message: "PPF PDF processed successfully",
      account: ppfAccount,
    });
  } catch (error) {
    console.error("PPF upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to process PPF PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
