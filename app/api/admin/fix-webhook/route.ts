import { NextRequest, NextResponse } from 'next/server'

export async function POST() {
  try {
    const newWebhookUrl = 'https://tma-subscription-nn1ll37q6-smits-projects-3d9ec8f0.vercel.app/api/webhook'
    const botToken = process.env.BOT_TOKEN

    if (!botToken) {
      return NextResponse.json(
        { error: 'BOT_TOKEN not configured' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: newWebhookUrl,
        }),
      }
    )

    const data = await response.json()

    if (data.ok) {
      return NextResponse.json({
        success: true,
        webhookUrl: newWebhookUrl,
        message: 'Webhook updated successfully'
      })
    } else {
      return NextResponse.json(
        {
          error: 'Failed to update webhook',
          details: data
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Webhook update error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}