export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Условия использования</h1>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Общие положения</h2>
            <p className="text-gray-600">
              Используя наше приложение для подписок, вы соглашаетесь с этими условиями использования.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Описание услуги</h2>
            <p className="text-gray-600">
              Мы предоставляем платформу для покупки и управления подписками на Telegram каналы.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Платежи</h2>
            <p className="text-gray-600">
              Все платежи осуществляются через TON блокчейн с использованием USDT.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Отказ от ответственности</h2>
            <p className="text-gray-600">
              Мы не несем ответственности за контент каналов, на которые вы подписываетесь.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Контакты</h2>
            <p className="text-gray-600">
              По всем вопросам обращайтесь в поддержку Telegram.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}