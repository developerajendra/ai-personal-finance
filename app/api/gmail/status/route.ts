import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { cookies } from 'next/headers';

const TOKENS_FILE = path.join(process.cwd(), 'data', 'gmail-tokens.json');

export async function GET() {
  try {
    // Check for tokens in file
    let hasTokens = false;
    let isExpired = false;

    if (fs.existsSync(TOKENS_FILE)) {
      try {
        const data = fs.readFileSync(TOKENS_FILE, 'utf-8');
        const tokens = JSON.parse(data);
        hasTokens = !!(tokens.accessToken && tokens.refreshToken);
        
        // Check if token is expired
        if (tokens.expiryDate && tokens.expiryDate < Date.now()) {
          isExpired = true;
        }
      } catch (error) {
        console.error('[Gmail Status] Error reading tokens:', error);
      }
    }

    // Also check cookie
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('gmail_access_token');

    return NextResponse.json({
      isConnected: hasTokens || !!cookieToken,
      hasTokens,
      isExpired,
      message: hasTokens
        ? isExpired
          ? 'Connected but token expired'
          : 'Connected'
        : 'Not connected',
    });
  } catch (error: any) {
    console.error('[Gmail Status] Error:', error);
    return NextResponse.json(
      { isConnected: false, error: error.message },
      { status: 500 }
    );
  }
}

