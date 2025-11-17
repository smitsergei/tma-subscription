import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Проверка авторизации GitHub Actions
function verifyGitHubAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const githubSecret = process.env.GH_CRON_SECRET

  if (!githubSecret) {
    console.warn('GH_CRON_SECRET not set, skipping auth verification')
    return false
  }

  return authHeader === `Bearer ${githubSecret}`
}

export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    if (!verifyGitHubAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('GitHub Actions check started at:', new Date().toISOString())

    const body = await request.json()
    const { action } = body

    let results = []

    // Выполняем различные проверки в зависимости от действия
    if (!action || action === 'all') {
      // Запуск всех проверок с правильными методами
      results.push(await runCheck('subscriptions', '/api/cron/check-subscriptions', 'GET'))
      results.push(await runCheck('demo-access', '/api/cron/check-demo-access', 'POST'))
      results.push(await runCheck('scheduled-broadcasts', '/api/cron/scheduled-broadcasts', 'GET'))
    } else {
      // Запуск конкретной проверки
      const endpoints: Record<string, {path: string, method: string}> = {
        'subscriptions': {path: '/api/cron/check-subscriptions', method: 'GET'},
        'demo-access': {path: '/api/cron/check-demo-access', method: 'POST'},
        'scheduled-broadcasts': {path: '/api/cron/scheduled-broadcasts', method: 'GET'}
      }

      const endpoint = endpoints[action]
      if (endpoint) {
        results.push(await runCheck(action, endpoint.path, endpoint.method))
      } else {
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
      }
    }

    const successCount = results.filter(r => r.success).length
    const totalCount = results.length

    console.log(`GitHub Actions check completed. Success: ${successCount}/${totalCount}`)

    return NextResponse.json({
      success: successCount === totalCount,
      message: `Completed ${totalCount} checks. Success: ${successCount}`,
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error) {
    console.error('Error in GitHub Actions check:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function runCheck(name: string, endpoint: string, method: string = 'GET'): Promise<{name: string, success: boolean, message: string, data?: any}> {
  try {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000'
    const cronSecret = process.env.CRON_SECRET

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (cronSecret) {
      headers['Authorization'] = `Bearer ${cronSecret}`
    }

    console.log(`Running check: ${name} -> ${baseUrl}${endpoint}`)

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log(`✅ ${name}: Success`)
      return {
        name,
        success: true,
        message: data.message || 'Check completed successfully',
        data
      }
    } else {
      console.error(`❌ ${name}: Failed - ${data.error || 'Unknown error'}`)
      return {
        name,
        success: false,
        message: data.error || 'Check failed',
        data
      }
    }

  } catch (error) {
    console.error(`❌ ${name}: Error -`, error)
    return {
      name,
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Также поддерживаем GET для простого пинга
export async function GET(request: NextRequest) {
  try {
    if (!verifyGitHubAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'GitHub Actions endpoint is ready',
      timestamp: new Date().toISOString(),
      available: ['subscriptions', 'demo-access', 'scheduled-broadcasts']
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}