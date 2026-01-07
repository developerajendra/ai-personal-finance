import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { cookies } from 'next/headers';

const TOKENS_FILE = path.join(process.cwd(), 'data', 'gmail-tokens.json');

export async function POST(request: NextRequest) {
  try {
    // Delete tokens file
    if (fs.existsSync(TOKENS_FILE)) {
      fs.unlinkSync(TOKENS_FILE);
    }

    // Delete cookie
    const cookieStore = await cookies();
    cookieStore.delete('gmail_access_token');

    // Also notify the portfolio agent to clear tokens
    // This will be handled when the agent restarts or checks status

    return NextResponse.json({
      success: true,
      message: 'Gmail disconnected successfully',
    });
  } catch (error: any) {
    console.error('[Gmail Disconnect] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}

