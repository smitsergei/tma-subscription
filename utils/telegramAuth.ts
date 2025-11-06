// Утилита для получения Telegram WebApp данных

export function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null

  try {
    console.log('🔍 TELEGRAM AUTH: Starting Telegram data extraction...')
    console.log('🔍 TELEGRAM AUTH: Current URL:', window.location.href)

    // Проверяем Telegram WebApp API через any для обхода типов
    const telegramWebApp = (window as any).Telegram?.WebApp
    console.log('🔍 TELEGRAM AUTH: Telegram WebApp available:', !!telegramWebApp)

    if (telegramWebApp?.initData) {
      console.log('🔍 TELEGRAM AUTH: Found Telegram WebApp initData, length:', telegramWebApp.initData.length)
      console.log('🔍 TELEGRAM AUTH: InitData preview:', telegramWebApp.initData.substring(0, 100) + '...')
      return telegramWebApp.initData
    }

    // Пробуем получить данные из URL hash (для Telegram WebApp)
    console.log('🔍 TELEGRAM AUTH: Checking URL hash...')
    const hash = window.location.hash.slice(1)
    console.log('🔍 TELEGRAM AUTH: Hash:', hash ? hash.substring(0, 100) + '...' : 'empty')

    const urlParams = new URLSearchParams(hash)
    const webAppData = urlParams.get('tgWebAppData')

    if (webAppData) {
      console.log('🔍 TELEGRAM AUTH: Found tgWebAppData in hash, length:', webAppData.length)
      return webAppData
    }

    // Пробуем получить из URL search (для прямых ссылок)
    console.log('🔍 TELEGRAM AUTH: Checking URL search...')
    const search = window.location.search
    console.log('🔍 TELEGRAM AUTH: Search:', search ? search.substring(0, 100) + '...' : 'empty')

    const searchParams = new URLSearchParams(search)
    const initData = searchParams.get('tgWebAppData')

    if (initData) {
      console.log('🔍 TELEGRAM AUTH: Found tgWebAppData in search, length:', initData.length)
      return initData
    }

    // Ищем любые параметры, которые могут содержать Telegram данные
    console.log('🔍 TELEGRAM AUTH: Looking for any Telegram-related parameters...')
    const allHashParams = Array.from(urlParams.entries())
    const allSearchParams = Array.from(searchParams.entries())

    console.log('🔍 TELEGRAM AUTH: Hash params:', allHashParams.map(([k, v]) => `${k}=${v?.substring(0, 30)}...`))
    console.log('🔍 TELEGRAM AUTH: Search params:', allSearchParams.map(([k, v]) => `${k}=${v?.substring(0, 30)}...`))

    // Пробуем найти user параметр напрямую
    const userParam = urlParams.get('user') || searchParams.get('user')
    if (userParam) {
      console.log('🔍 TELEGRAM AUTH: Found user param, creating basic init data')
      // Создаем базовые init данные из user параметра
      const basicInitData = `user=${encodeURIComponent(userParam)}`
      return basicInitData
    }

    console.log('🔍 TELEGRAM AUTH: No Telegram data found, returning null')
    return null
  } catch (error) {
    console.error('🔍 TELEGRAM AUTH: Error getting Telegram init data:', error)
    return null
  }
}

export function getTelegramUser(): any | null {
  if (typeof window === 'undefined') return null

  try {
    const initData = getTelegramInitData()
    if (!initData) return null

    const params = new URLSearchParams(initData)
    const userStr = params.get('user')

    if (!userStr) return null

    return JSON.parse(decodeURIComponent(userStr))
  } catch (error) {
    console.error('Error parsing Telegram user:', error)
    return null
  }
}

// Функция для создания аутентифицированного запроса (только настоящие данные)
export function createAuthenticatedRequest(options: RequestInit = {}): RequestInit {
  const initData = getTelegramInitData()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (initData) {
    headers['x-telegram-init-data'] = initData
    console.log('🔍 AUTH REQUEST: Using real Telegram init data, length:', initData.length)
  } else {
    console.log('🔍 AUTH REQUEST: WARNING - No Telegram init data found!')
  }

  return {
    ...options,
    headers,
  }
}

// Создание тестовых init данных для разработки
function createTestInitData(): string {
  const testUser = {
    id: 123456789,
    first_name: "Admin",
    last_name: "Test",
    username: "admin_test",
    language_code: "ru"
  }

  const userStr = encodeURIComponent(JSON.stringify(testUser))
  const authDate = Math.floor(Date.now() / 1000)

  return `user=${userStr}&auth_date=${authDate}&hash=test_hash_for_development`
}

// Временная функция для тестирования в браузере
export function createTestAuthenticatedRequest(options: RequestInit = {}): RequestInit {
  // Создаем тестовые данные для администратора (замените на реальные данные)
  const testAdminData = 'query_id=AAHdAa0kAAAAAGQGrJCd7m3f&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22Admin%22%2C%22username%22%3A%22testadmin%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=1698000000&hash=test_hash_for_development'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-telegram-init-data': testAdminData,
    ...((options.headers as Record<string, string>) || {}),
  }

  return {
    ...options,
    headers,
  }
}