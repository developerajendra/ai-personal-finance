import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/core/auth/getSession";
import * as userConfigRepo from "@/core/db/repositories/userConfigRepository";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const [zerodhaConfigs, gmailConfigs, aiConfigs] = await Promise.all([
      userConfigRepo.getConfigsByProvider(userId, "zerodha"),
      userConfigRepo.getConfigsByProvider(userId, "gmail"),
      userConfigRepo.getConfigsByProvider(userId, "ai"),
    ]);

    const mask = (value: string) =>
      value.length > 6 ? value.slice(0, 3) + "***" + value.slice(-3) : "***";

    return NextResponse.json({
      zerodha: {
        api_key: zerodhaConfigs.find((c) => c.configKey === "api_key")?.configValue
          ? mask(zerodhaConfigs.find((c) => c.configKey === "api_key")!.configValue)
          : null,
        api_secret: zerodhaConfigs.find((c) => c.configKey === "api_secret")?.configValue
          ? "configured"
          : null,
        hasConfig: zerodhaConfigs.length > 0,
      },
      gmail: {
        hasTokens:
          !!gmailConfigs.find((c) => c.configKey === "access_token")?.configValue,
      },
      ai: {
        api_key: aiConfigs.find((c) => c.configKey === "api_key")?.configValue
          ? mask(aiConfigs.find((c) => c.configKey === "api_key")!.configValue)
          : null,
      },
      user: {
        name: session.name,
        email: session.email,
      },
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;
    const body = await request.json();
    const { provider, configs } = body;

    if (!provider || !configs || typeof configs !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    for (const [key, value] of Object.entries(configs)) {
      if (typeof value === "string" && value.trim()) {
        await userConfigRepo.setConfig(userId, provider, key, value.trim());
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;
    const { provider } = await request.json();

    if (!provider) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 });
    }

    await userConfigRepo.deleteAllByProvider(userId, provider);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting settings:", error);
    return NextResponse.json({ error: "Failed to delete settings" }, { status: 500 });
  }
}
