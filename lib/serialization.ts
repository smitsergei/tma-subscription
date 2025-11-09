// Утилиты для сериализации данных с BigInt

// Кастомный replacer для JSON.stringify
export const bigintReplacer = (_: string, value: any): any => {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

// Безопасная JSON сериализация с поддержкой BigInt
export function safeJsonStringify(obj: any): string {
  return JSON.stringify(obj, bigintReplacer)
}

// Кастомный сериализатор для Next.js
export function createJsonResponse(data: any, status = 200): Response {
  const jsonString = safeJsonStringify(data)

  return new Response(jsonString, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

// Transform function для Prisma результатов
export function transformPrismaData(data: any): any {
  if (data === null || data === undefined) return data

  if (Array.isArray(data)) {
    return data.map(item => transformPrismaData(item))
  }

  if (typeof data === 'object') {
    const transformed: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'bigint') {
        transformed[key] = value.toString()
      } else if (value instanceof Date) {
        transformed[key] = value.toISOString()
      } else if (typeof value === 'object' && value !== null) {
        transformed[key] = transformPrismaData(value)
      } else {
        transformed[key] = value
      }
    }
    return transformed
  }

  return data
}