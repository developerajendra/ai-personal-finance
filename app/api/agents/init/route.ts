import { NextResponse } from 'next/server';
import { initializeAgents } from '@/core/agents/agentManager';

export async function POST() {
  try {
    await initializeAgents();
    return NextResponse.json({
      success: true,
      message: 'Agents initialized successfully',
    });
  } catch (error: any) {
    console.error('[Agent Init] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to initialize agents',
      },
      { status: 500 }
    );
  }
}

