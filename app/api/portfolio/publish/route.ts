import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { setPublished, type PublishableType } from "@/server/finance/portfolio/service";
import { ValidationError } from "@/server/finance/common";

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

    return NextResponse.json({
      success: true,
      item,
      message: isPublished ? "Item published successfully" : "Item moved to draft"
    });
  } catch (error) {
    return errorResponse(error, "Failed to update publish status");
  }
}
