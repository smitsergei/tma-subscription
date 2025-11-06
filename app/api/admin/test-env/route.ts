import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      environment: {
        BOT_TOKEN: process.env.BOT_TOKEN ? 'Present' : 'Missing',
        BOT_TOKEN_LENGTH: process.env.BOT_TOKEN?.length || 0,
        TON_WALLET_ADDRESS: process.env.TON_WALLET_ADDRESS || 'Missing',
        TON_WALLET_PREVIEW: process.env.TON_WALLET_ADDRESS ? process.env.TON_WALLET_ADDRESS.substring(0, 10) + '...' : 'Missing',
        TONCENTER_API_KEY: process.env.TONCENTER_API_KEY ? 'Present' : 'Missing',
        TONCENTER_API_LENGTH: process.env.TONCENTER_API_KEY?.length || 0,
        APP_URL: process.env.APP_URL || 'Missing',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'Missing',
        POSTGRES_URL: process.env.POSTGRES_URL ? 'Present' : 'Missing',
        NODE_ENV: process.env.NODE_ENV || 'Unknown'
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}