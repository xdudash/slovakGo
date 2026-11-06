# Покупки App Store (SlovakGO Plus в iOS)

Ветка: `feat/ios-in-app-purchases`. Документ описывает, как устроены покупки и что нужно настроить в App Store Connect перед TestFlight.

## Как это работает

- В iOS Plus продаётся только через In-App Purchase (StoreKit 2). Stripe и ссылки на веб-оплату в приложении не показываются. Веб-версия по-прежнему продаёт через Stripe.
- Нативный плагин `ios/App/App/StorePlugin.swift` (JS-имя `SlovakGoStore`): загрузка товаров, покупка, «Восстановить покупки», окно управления подпиской Apple, поток `Transaction.updates`.
- Клиент `src/services/appStoreBilling.ts` отправляет подписанные Apple транзакции (JWS) на сервер. Транзакция завершается (`finish`) только после того, как сервер её сохранил. Если сеть пропала, StoreKit отдаст её снова при следующем запуске.
- Экран покупки: `src/components/AppStoreOffer.tsx`. Цены, валюта и доступность пробного периода берутся из App Store, а не из кода.
- Сервер `api/_lib/apple.ts` проверяет подпись официальной библиотекой Apple (`@apple/app-store-server-library`, корневой сертификат Apple Root CA G3 встроен в `api/_lib/appleRootCa.ts`). Также проверяются bundle ID, товар и окружение. Покупки из локальной конфигурации Xcode сервер отклоняет намеренно.
- Доступ хранится отдельно от Stripe: таблица `apple_subscriptions` и колонки `users.apple_status` / `users.apple_expires_at`. Вебхуки Stripe эти данные не трогают.
- Одна подписка Apple принадлежит одному аккаунту SlovakGO. Попытка привязать её ко второму аккаунту получает ответ 409. При удалении аккаунта привязка снимается, и подписку можно восстановить в новый аккаунт. Отменить подписку Apple с сервера нельзя, это делает сам пользователь в настройках Apple ID.

| Маршрут | Назначение |
| --- | --- |
| `GET /api/billing/apple/account` | `appAccountToken` пользователя и список товаров |
| `POST /api/billing/apple/transactions` | Транзакции после покупки и восстановления |
| `POST /api/billing/apple/notifications` | App Store Server Notifications V2: продление, grace period, истечение, возврат |

## Настройка в App Store Connect

1. Создать приложение с Bundle ID `sk.slovakgo.app`, если записи ещё нет.
2. **Business → Agreements:** принять Paid Apps Agreement, заполнить банковские и налоговые данные. Без этого товары не загружаются даже в sandbox.
3. **Monetization → Subscriptions:** группа подписок «SlovakGO Plus» с двумя автопродлеваемыми подписками. ID должны совпадать в точности:
   - `sk.slovakgo.app.plus.monthly` — 1 месяц;
   - `sk.slovakgo.app.plus.yearly` — 1 год.
   Настроено 7 ноября 2026: цены €3.99 в месяц и €29.99 в год (базовая страна Словакия, остальные пересчитаны Apple). Это выше, чем €3 и €20 на сайте: разница покрывает комиссию Apple. Пробный период — Introductory Offer «Free», 3 дня, у обеих подписок. Названия на украинском, английском (U.K., текст на украинском), русском и словацком. Осталось добавить скриншот экрана покупки для review.
4. **App Information → App Store Server Notifications:** Version 2, URL для Production и Sandbox:
   `https://app.slovakgo.sk/api/billing/apple/notifications`
5. Apple ID приложения (`6830364262`) прописан в `api/_lib/apple.ts`. Переменная `APPLE_APP_ID` на Vercel нужна, только если приложение пересоздадут с другим ID.
6. **Users and Access → Sandbox Testers:** создать тестовый Apple ID для проверки покупок.

## Проверка

- Автотесты: `npm test` (сервер — блок «App Store subscriptions» в `src/__tests__/api.test.ts`, клиент — `src/services/appStoreBilling.test.ts`).
- Локальная проверка окна покупки без App Store Connect: в Xcode **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration → `SlovakGO.storekit`**. Покупка пройдёт, но сервер её не примет: локальные транзакции Xcode не подписаны Apple. Для обычной работы конфигурацию выключить.
- Сквозная проверка: после шагов 1–6 собрать сборку на iPhone или в TestFlight и купить под sandbox Apple ID. Проверить пробный период, восстановление после переустановки, отмену в настройках Apple ID, отказ при покупке со второго аккаунта.

## Что ещё нужно до отправки на review

- Политика конфиденциальности по адресу `https://www.slovakgo.sk/privacy`: на неё ссылается экран покупки, а Apple требует её и в метаданных. Сейчас такой страницы нет.
- В качестве условий использования экран покупки ссылается на стандартное лицензионное соглашение Apple (EULA). Если появятся собственные условия, поменять `TERMS_OF_USE_URL` в `src/components/AppStoreOffer.tsx`.
