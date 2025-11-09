export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Политика конфиденциальности</h1>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Сбор данных</h2>
            <p className="text-gray-600">
              Мы собираем только необходимую информацию для предоставления услуг:
              Telegram ID, имя пользователя и данные о подписках.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Использование данных</h2>
            <p className="text-gray-600">
              Ваши данные используются только для управления подписками и обработки платежей.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Хранение данных</h2>
            <p className="text-gray-600">
              Все данные хранятся в зашифрованном виде на защищенных серверах.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Транзакции</h2>
            <p className="text-gray-600">
              Информация о транзакциях в блокчейне является публичной, но не связана с вашей личностью.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Ваши права</h2>
            <p className="text-gray-600">
              Вы можете запросить удаление своих данных в любой момент.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Контакты</h2>
            <p className="text-gray-600">
              По вопросам конфиденциальности обращайтесь в поддержку.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}