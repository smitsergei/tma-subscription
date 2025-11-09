export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Политика конфиденциальности</h1>

        <div className="bg-white rounded-lg p-6 space-y-4">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Собираемая информация</h2>
            <p className="text-gray-700">
              Мы собираем минимально необходимую информацию для предоставления услуг:
            </p>
            <ul className="list-disc list-inside mt-2 text-gray-700">
              <li>ID пользователя Telegram</li>
              <li>Имя пользователя и никнейм</li>
              <li>Информация о подписках и платежах</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Использование информации</h2>
            <p className="text-gray-700">
              Собранная информация используется для:
            </p>
            <ul className="list-disc list-inside mt-2 text-gray-700">
              <li>Предоставления доступа к подпискам</li>
              <li>Обработки платежей</li>
              <li>Технической поддержки</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Хранение данных</h2>
            <p className="text-gray-700">
              Данные хранятся на защищенных серверах и не передаются третьим лицам,
              за исключением случаев, предусмотренных законодательством.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Блокчейн транзакции</h2>
            <p className="text-gray-700">
              Информация о транзакциях в блокчейне TON является публичной и не может быть удалена.
              Это включает адреса кошельков и суммы транзакций.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Права пользователей</h2>
            <p className="text-gray-700">
              Пользователи имеют право на получение информации о своих данных
              и их удаление по запросу (за исключением блокчейн транзакций).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Безопасность</h2>
            <p className="text-gray-700">
              Мы применяем современные меры безопасности для защиты данных пользователей.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Контакты</h2>
            <p className="text-gray-700">
              По вопросам обработки персональных данных обращайтесь через поддержку в Telegram.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}