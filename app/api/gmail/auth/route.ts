import { NextResponse } from 'next/server';
import { getGmailAuthUrl } from '@/core/services/gmailService';

export async function GET() {
  try {
    const authUrl = getGmailAuthUrl();
    return NextResponse.json({ loginUrl: authUrl });
  } catch (error: any) {
    console.error('[Gmail Auth] Error generating auth URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

