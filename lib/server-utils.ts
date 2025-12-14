
import crypto from 'crypto';

/**
 * Проверка подписи NOWPayments IPN
 * @param ipnData Данные уведомления (тело запроса)
 * @param signature Подпись из заголовка x-nowpayments-sig
 * @param ipnSecret Секретный ключ IPN
 */
export async function verifyNOWPaymentsIPN(
  ipnData: any,
  signature: string,
  ipnSecret: string
): Promise<boolean> {
  try {
    // Создаем строку для HMAC
    const hmac = crypto.createHmac('sha512', ipnSecret)
    hmac.update(JSON.stringify(ipnData, Object.keys(ipnData).sort()))
    const calculatedSignature = hmac.digest('hex')

    return calculatedSignature === signature
  } catch (error) {
    console.error('Error verifying NOWPayments IPN signature:', error)
    return false
  }
}
