import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Received request to create product')

    const body = await request.json()
    console.log('🔍 DEBUG: Request body:', body)

    const headers = Object.fromEntries(request.headers.entries())
    console.log('🔍 DEBUG: Request headers:', headers)

    const initData = request.headers.get('x-telegram-init-data')
    console.log('🔍 DEBUG: Telegram init data present:', !!initData)

    if (initData) {
      console.log('🔍 DEBUG: Init data length:', initData.length)
      console.log('🔍 DEBUG: Init data preview:', initData.substring(0, 100) + '...')
    }

    return NextResponse.json({
      success: true,
      message: 'Debug info collected',
      debug: {
        bodyReceived: !!body,
        headersCount: Object.keys(headers).length,
        hasTelegramData: !!initData,
        bodyKeys: Object.keys(body),
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('🔍 DEBUG: Error in debug endpoint:', error)
    return NextResponse.json({
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}