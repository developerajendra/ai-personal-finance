import { NextRequest, NextResponse } from 'next/server';
import {
  getGlobalReferenceData,
  updateReferenceDataKey,
  deleteReferenceDataKey,
  setGlobalReferenceData,
} from '@/core/services/loanReferenceDataService';

export async function GET() {
  try {
    const referenceData = getGlobalReferenceData();
    return NextResponse.json({ referenceData });
  } catch (error: any) {
    console.error('Error fetching loan reference data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reference data' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'key is required' },
        { status: 400 }
      );
    }

    const referenceData = updateReferenceDataKey(key, value);
    return NextResponse.json({ referenceData });
  } catch (error: any) {
    console.error('Error updating loan reference data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update reference data' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'key is required' },
        { status: 400 }
      );
    }

    const referenceData = deleteReferenceDataKey(key);
    return NextResponse.json({ referenceData });
  } catch (error: any) {
    console.error('Error deleting loan reference data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete reference data' },
      { status: 500 }
    );
  }
}
