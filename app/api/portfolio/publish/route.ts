import { NextRequest, NextResponse } from "next/server";
import { Investment, Loan, Property, BankBalance } from "@/core/types";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";
import { moveEmailToLabel } from "@/core/services/gmailService";
import { cookies } from "next/headers";
import * as fs from "fs";
import * as path from "path";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const body = await request.json();
    const { type, id, isPublished } = body;

    if (!type || !id || typeof isPublished !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: type, id, isPublished" },
        { status: 400 }
      );
    }

    initializeStorage();

    let item: Investment | Loan | Property | BankBalance | null = null;
    let updated = false;

    if (type === "investment") {
      const data = loadFromJson<Investment>("investments", userId);
      const index = data.findIndex(i => i.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], isPublished, updatedAt: new Date().toISOString() };
        item = data[index];
        saveToJson("investments", data, userId);
        updated = true;

        if (isPublished) {
          try {
            console.log(`[Publish] Investment ${id} is being published, looking for associated email...`);
            const processedEmailsFile = path.join(process.cwd(), 'data', 'processed-emails.json');
            if (fs.existsSync(processedEmailsFile)) {
              const processedEmails = JSON.parse(fs.readFileSync(processedEmailsFile, 'utf-8'));
              console.log(`[Publish] Found ${processedEmails.length} processed emails in file`);
              const processedEmail = processedEmails.find((pe: any) => pe.investmentId === id);
              
              if (processedEmail?.emailId) {
                console.log(`[Publish] Found email ${processedEmail.emailId} for investment ${id}`);
                const cookieStore = await cookies();
                const accessToken = cookieStore.get('gmail_access_token')?.value || process.env.GMAIL_ACCESS_TOKEN;
                const refreshToken = cookieStore.get('gmail_refresh_token')?.value || process.env.GMAIL_REFRESH_TOKEN;
                
                if (accessToken && refreshToken) {
                  console.log(`[Publish] Gmail tokens available, moving email to personal-finance label...`);
                  try {
                    await moveEmailToLabel(accessToken, refreshToken, processedEmail.emailId, 'personal-finance');
                    console.log(`[Publish] ✅ Successfully moved email ${processedEmail.emailId} to personal-finance label for investment ${id}`);
                  } catch (labelError: any) {
                    console.log(`[Publish] Trying with space variation...`);
                    try {
                      await moveEmailToLabel(accessToken, refreshToken, processedEmail.emailId, 'personal finance');
                      console.log(`[Publish] ✅ Successfully moved email ${processedEmail.emailId} to "personal finance" label for investment ${id}`);
                    } catch (spaceError: any) {
                      console.error(`[Publish] Failed to move email with both variations:`, {
                        hyphenError: labelError.message,
                        spaceError: spaceError.message,
                      });
                      throw spaceError;
                    }
                  }
                } else {
                  console.warn('[Publish] Gmail tokens not available, skipping email move');
                  console.warn('[Publish] Access token present:', !!accessToken);
                  console.warn('[Publish] Refresh token present:', !!refreshToken);
                }
              } else {
                console.log(`[Publish] No email found for investment ${id} in processed-emails.json`);
                console.log(`[Publish] Available investment IDs in processed emails:`, 
                  processedEmails.filter((pe: any) => pe.investmentId).map((pe: any) => pe.investmentId)
                );
              }
            } else {
              console.warn(`[Publish] Processed emails file not found at: ${processedEmailsFile}`);
            }
          } catch (error: any) {
            console.error('[Publish] Error moving email to personal-finance folder:', error);
            console.error('[Publish] Error stack:', error.stack);
          }
        }
      }
    } else if (type === "loan") {
      const data = loadFromJson<Loan>("loans", userId);
      const index = data.findIndex(l => l.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], isPublished, updatedAt: new Date().toISOString() };
        item = data[index];
        saveToJson("loans", data, userId);
        updated = true;
      }
    } else if (type === "property") {
      const data = loadFromJson<Property>("properties", userId);
      const index = data.findIndex(p => p.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], isPublished, updatedAt: new Date().toISOString() };
        item = data[index];
        saveToJson("properties", data, userId);
        updated = true;
      }
    } else if (type === "bank-balance") {
      const data = loadFromJson<BankBalance>("bankBalances", userId);
      const index = data.findIndex(bb => bb.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], isPublished, updatedAt: new Date().toISOString() };
        item = data[index];
        saveToJson("bankBalances", data, userId);
        updated = true;
      }
    }

    if (!updated || !item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item,
      message: isPublished ? "Item published successfully" : "Item moved to draft"
    });
  } catch (error: any) {
    console.error("Error updating publish status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update publish status" },
      { status: 500 }
    );
  }
}
