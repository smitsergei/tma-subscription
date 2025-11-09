export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Условия использования</h1>

        <div className="bg-white rounded-lg p-6 space-y-4">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Описание услуги</h2>
            <p className="text-gray-700">
              Наш сервис предоставляет платные подписки на эксклюзивный контент в Telegram каналах.
              Пользователи могут приобретать доступ на определенный период времени.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Оплата</h2>
            <p className="text-gray-700">
              Оплата производится в криптовалюте USDT через блокчейн TON.
              Все транзакции необратимы. Подписка активируется после успешного подтверждения платежа.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Доступ к контенту</h2>
            <p className="text-gray-700">
              После успешной оплаты пользователь получает доступ к закрытому контенту на весь период подписки.
              Доступ прекращается автоматически по истечении срока действия подписки.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Ответственность</h2>
            <p className="text-gray-700">
              Администрация не несет ответственности за технические сбои блокчейна TON
              и проблемы с подключением кошельков.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Возврат средств</h2>
            <p className="text-gray-700">
              Возврат средств невозможен, так как транзакции в блокчейне необратимы.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Изменение условий</h2>
            <p className="text-gray-700">
              Администрация оставляет за собой право изменять условия использования.
              Изменения вступают в силу с момента публикации.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}