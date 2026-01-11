import { NextRequest, NextResponse } from 'next/server';
import { getLoanEmailMetadata, getAllLoanEmailMetadata } from '@/core/services/loanEmailMetadataService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const loanId = searchParams.get('loanId');

    if (loanId) {
      const metadata = getLoanEmailMetadata(loanId);
      if (!metadata) {
        return NextResponse.json(
          { error: 'No email metadata found for this loan' },
          { status: 404 }
        );
      }
      return NextResponse.json({ metadata });
    }

    // Return all metadata
    const allMetadata = getAllLoanEmailMetadata();
    return NextResponse.json({ metadata: allMetadata });
  } catch (error: any) {
    console.error('Error fetching loan email metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch email metadata' },
      { status: 500 }
    );
  }
}
