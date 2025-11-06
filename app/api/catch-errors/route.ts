// Middleware для перехвата всех ошибок в единый лог
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.error('🚨 ERROR CATCHER: Received error data:', body)

    return NextResponse.json({
      received: true,
      timestamp: new Date().toISOString(),
      data: body
    })
  } catch (error) {
    console.error('🚨 ERROR CATCHER: Failed to parse error:', error)
    return NextResponse.json({
      error: 'Failed to parse error data'
    }, { status: 500 })
  }
}