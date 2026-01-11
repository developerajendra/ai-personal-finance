import { NextRequest, NextResponse } from 'next/server';
import {
  loadLoanEmailPatterns,
  saveLoanEmailPatterns,
  addLoanEmailPattern,
  updateLoanEmailPattern,
  deleteLoanEmailPattern,
  getLoanEmailPattern,
} from '@/core/services/loanEmailPatternService';
import { LoanEmailPattern } from '@/core/services/loanEmailPatternService';

export async function GET() {
  try {
    const patterns = loadLoanEmailPatterns();
    return NextResponse.json({ patterns });
  } catch (error: any) {
    console.error('Error fetching loan email patterns:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch patterns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, type, enabled = true } = body;

    if (!title || !type) {
      return NextResponse.json(
        { error: 'Title and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'quarterly-summary' && type !== 'interest-rate-change' && type !== 'other') {
      return NextResponse.json(
        { error: 'Type must be "quarterly-summary", "interest-rate-change", or "other"' },
        { status: 400 }
      );
    }

    const pattern = addLoanEmailPattern({
      title: title.trim(),
      type,
      enabled,
    });

    return NextResponse.json({ pattern }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating loan email pattern:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create pattern' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, type, enabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const updates: Partial<LoanEmailPattern> = {};
    if (title !== undefined) updates.title = title.trim();
    if (type !== undefined) {
      if (type !== 'quarterly-summary' && type !== 'interest-rate-change' && type !== 'other') {
        return NextResponse.json(
          { error: 'Type must be "quarterly-summary", "interest-rate-change", or "other"' },
          { status: 400 }
        );
      }
      updates.type = type;
    }
    if (enabled !== undefined) updates.enabled = enabled;

    const updated = updateLoanEmailPattern(id, updates);
    if (!updated) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ pattern: updated });
  } catch (error: any) {
    console.error('Error updating loan email pattern:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update pattern' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const deleted = deleteLoanEmailPattern(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting loan email pattern:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete pattern' },
      { status: 500 }
    );
  }
}
