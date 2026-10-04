import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { setPublished, type PublishableType } from "@/server/finance/portfolio/service";
import { ValidationError } from "@/server/finance/common";
import { moveEmailToLabel } from "@/server/integrations/gmail/gmailService";
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
    const { id, isPublished } = body;
    // Receivables are bank balances tagged "receivable"
    const type = body.type === "receivables" ? "bank-balance" : body.type;

    if (!type || !id || typeof isPublished !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: type, id, isPublished" },
        { status: 400 }
      );
    }

    const validTypes: PublishableType[] = ["investment", "loan", "property", "bank-balance"];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Invalid type. Must be one of: ${validTypes.join(", ")}`);
    }

    // Single-row update scoped to the user; throws NotFound (404) if absent.
    const item = await setPublished(userId, type, id, isPublished);

    if (type === "investment") {
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
                  console.log(`[Publish] Successfully moved email ${processedEmail.emailId} to personal-finance label for investment ${id}`);
                } catch (labelError: any) {
                  console.log(`[Publish] Trying with space variation...`);
                  try {
                    await moveEmailToLabel(accessToken, refreshToken, processedEmail.emailId, 'personal finance');
                    console.log(`[Publish] Successfully moved email ${processedEmail.emailId} to "personal finance" label for investment ${id}`);
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

    return NextResponse.json({
      success: true,
      item,
      message: isPublished ? "Item published successfully" : "Item moved to draft"
    });
  } catch (error) {
    return errorResponse(error, "Failed to update publish status");
  }
}
