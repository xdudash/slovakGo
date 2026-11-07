# SlovakGO iOS → App Store: передача задач

Состояние на 7 ноября 2026. Документ для следующего агента или разработчика. Что уже сделано и что осталось, со всеми ID и путями.

## Коротко

SlovakGO — React/Vite PWA (уроки словацкого для украинцев), обёрнутое в iOS-приложение на Capacitor 8. В iOS подписка Plus продаётся только через App Store In-App Purchase (StoreKit 2); веб продолжает продавать через Stripe. Код готов и проверен тестами. Страница в App Store Connect заполнена. Осталось: юридические и финансовые пункты владельца аккаунта, подпись сборки правильной командой, загрузка сборки в TestFlight, тест покупки, деплой сервера и отправка на review.

## Репозиторий и ветка

- Рабочая копия: `/Users/keno/slovakGo/slovakGo`
- GitHub: `xdudash/slovakGo`, ветка `feat/ios-in-app-purchases`
- PR: https://github.com/xdudash/slovakGo/pull/28 — открыт, все проверки зелёные (app, api, landing, Vercel preview). **Не влит.** Влить в `main` = деплой на боевой сайт (Vercel), делать только с согласия владельца.
- Новая иконка `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (фиолетовый фон, белый маскот; копия в `output/brand/slovakgo-app-icon-1024.png`). Иконка и этот документ добавлены в ветку `feat/ios-in-app-purchases`.
- `output/` не под git: локальные материалы (скриншоты, бренд, аудиты).

## Ключевые идентификаторы

| Что | Значение |
| --- | --- |
| Компания (seller) | World Work, s.r.o., Družstevná 543, 956 19 Krnča, Slovensko, IČO 95099333 |
| Apple Team ID (App Store Connect) | `6TU82NKL53` |
| Bundle ID | `sk.slovakgo.app` |
| Apple ID приложения | `6830364262` (прописан в `api/_lib/apple.ts` как `APPLE_APP_ID`) |
| Группа подписок | `SlovakGO Plus`, ID `22542627` |
| Plus Monthly | `sk.slovakgo.app.plus.monthly` (Apple ID 6830373037), €3.99, 3 дня free trial |
| Plus Yearly | `sk.slovakgo.app.plus.yearly` (Apple ID 6831805702), €29.99, 3 дня free trial |
| Уведомления App Store (Prod и Sandbox) | `https://app.slovakgo.sk/api/billing/apple/notifications` |
| Боевой API | `https://app.slovakgo.sk/api` (Vercel, БД Turso) |
| Политика конфиденциальности | `https://www.slovakgo.sk/privacy` (страница в PR, на сайте появится после деплоя) |
| Демо-аккаунт для App Review | `premium-test@example.com` (пароль знает владелец; в файлы не записывать) |

Веб-цены (Stripe) другие: €3 в месяц и €20 в год, сервер проверяет их в `api/_lib/stripe.ts`. Цены в iOS выше специально, чтобы покрыть комиссию Apple.

## Что сделано

### Код (в PR #28)
- iOS-проект: `ios/App/App.xcodeproj` (SPM, без CocoaPods). Только iPhone (`TARGETED_DEVICE_FAMILY = 1`), `ITSAppUsesNonExemptEncryption = false`.
- StoreKit 2 плагин: `ios/App/App/StorePlugin.swift` (JS-имя `SlovakGoStore`), регистрируется в `ios/App/App/SceneDelegate.swift`.
- Клиент: `src/services/appStoreBilling.ts`, экран покупки `src/components/AppStoreOffer.tsx`, подключение в `src/features/student/StudentScreens.tsx` (Paywall, Shop, Profile) и `src/main.tsx`.
- Сервер: `api/_lib/apple.ts` (проверка JWS официальной библиотекой Apple, Apple Root CA G3 в `api/_lib/appleRootCa.ts`), маршруты в `api/index.ts`, статус доступа в `api/_lib/core.ts` (`appleAccess`, `billingProvider`), удаление привязки в `api/_lib/auth.ts`.
- Тесты: `npm test` (286 проходят; App Store: `src/__tests__/api.test.ts`, блок «App Store subscriptions», и `src/services/appStoreBilling.test.ts`).
- Лендинг: `landing/src/pages/privacy.astro`, ссылка в футере `landing/src/layouts/Base.astro`.
- Локальная StoreKit-конфигурация для Xcode: `ios/App/App/SlovakGO.storekit`.
- Генератор скриншотов: `scripts/store/compose_screenshots.py` (шрифты и вырезанные маскоты в `scripts/store/assets/`).
- Документация: `docs/IOS-PURCHASES.md`, `docs/IOS-DEVICE.md`, `docs/IOS-EXPERIENCE.md`, `docs/APP-STORE-RELEASE.md`.

### App Store Connect (уже заполнено)
- Приложение «SlovakGO: словацька мова», основной язык украинский, категории Education и Reference, цена Free, все 175 стран, без Mac и Vision Pro, релиз вручную.
- 4 локализации. Названия: uk «SlovakGO: словацька мова», en-GB «Словацька мова — SlovakGO», ru «SlovakGO: учи словацкий», sk «SlovakGO: učte sa slovenčinu». Подзаголовки, описания, промотекст, ключевые слова, Support и Marketing URL — на всех 4.
- ASO-логика: в словацком App Store индексируются только en-GB и sk, поэтому страница **en-GB заполнена по-украински** (её видят украинцы со словацким Apple ID). В украинском App Store индексируются uk, ru и en-GB.
- Нюанс App Store Connect: при сохранении нескольких локализаций App Information за раз одна отклоняется с ошибкой «name already used». Сохранять по одной и перезагружать страницу.
- Скриншоты: по 6 в слоте «iPhone with Dynamic Island (medium display)» (1206×2622) на всех 4 языках. Файлы: `output/app-store-screenshots/iphone-6.3/<uk|en-GB|ru|sk|en>/1-6.png` (en-GB = копия uk; `en` — английский набор на будущее), версии 1320×2868 в `iphone-6.9/`, исходники в `raw/`.
- Подписки: обе созданы, цены, trial, названия на 4 языках. **В review ещё не отправлены**: первая подписка уходит вместе с версией приложения.
- Age Ratings: заполнено (4+).
- Content Rights: проверено в App Store Connect 7 ноября 2026 — «No, it does not contain, show, or access third-party content». Пункт закрыт.
- App Review Information: логин демо-аккаунта и заметки для проверяющего вписаны; владелец вводит пароль и свои контакты.

## Что осталось

### Только владелец (агенту нельзя: юридические заявления, финансы, пароли)
Готовое письмо: `output/app-store-business-todo.md`.
1. **Business → Paid Apps Agreement** (сейчас «Pending User Info»): банковский счёт, налоговая форма (обычно W-8BEN-E), статус trader по DSA. Без этого подписки не загружаются даже в sandbox.
2. **App Information → Content Rights**: выполнено, ответ «No» подтверждён на странице.
3. **App Privacy**: Privacy Policy URL и данные (список в `output/app-store-business-todo.md`), Tracking: No.
4. **App Review Information**: пароль демо-аккаунта, имя, email → Save.
5. **App Store Small Business Program** (15% вместо 30%).
6. **Sandbox Tester** (Users and Access → Sandbox) для теста покупки.

### Для агента
1. Иконка и документ передачи добавлены в `feat/ios-in-app-purchases`; проверить результаты CI после push.
2. **Деплой:** проверить Vercel preview PR #28 (`/privacy` на лендинге, `GET /api/ping`, `GET /api/billing/apple/account` → 401 без сессии), затем с согласия владельца влить PR в `main`.
3. **Подпись сборки — главный блокер.** На этом Mac единственный сертификат — `Apple Development: tatherroyale@gmail.com`, а `ios/Signing.local.xcconfig` (в .gitignore) указывает на команду `QRA…`. Приложение принадлежит команде **World Work `6TU82NKL53`**. Владелец должен войти в Xcode → Settings → Accounts Apple ID с доступом к этой команде. Затем выставить `DEVELOPMENT_TEAM = 6TU82NKL53` в `ios/Signing.local.xcconfig` (или в Xcode → Signing & Capabilities) и включить capability Push Notifications (`App/Push.entitlements`, `aps-environment`).
4. **Сборка и TestFlight:**
   ```sh
   npm ci && npm run ios:sync
   xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
     -destination 'generic/platform=iOS' -archivePath ios-build/SlovakGO.xcarchive \
     -allowProvisioningUpdates archive
   ```
   Затем загрузить через Xcode Organizer (Distribute App → App Store Connect) или `xcodebuild -exportArchive` с `method app-store-connect` и `destination upload`. Перед каждой новой загрузкой увеличивать `CURRENT_PROJECT_VERSION` (build number; сейчас 1, `MARKETING_VERSION` 1.0).
5. **Тест покупки** (после пункта 1 у владельца и деплоя): TestFlight на iPhone, sandbox Apple ID, купить Plus. Проверить, что сервер выдал доступ (`users.apple_status`), что работает «Восстановить покупки» и что второй аккаунт получает 409.
6. **Отправка:** на странице версии 1.0 выбрать сборку, в In-App Purchases and Subscriptions добавить обе подписки, Add for Review → Submit.

### Желательно после запуска
- Окно оценки Apple (SKStoreReviewController) после 3–5 уроков: рейтинг сильно влияет на позицию в поиске.
- Обновить favicon и PWA-иконки сайта под новую иконку.
- Push-уведомления (APNs) пока выключены; см. `docs/IOS-EXPERIENCE.md`.

## Окружение этого Mac
- Xcode 27.1. Обычный iOS-симулятор — **iOS 27.0** (установленный iOS 27.1 — специальная сборка только для «iPhone Duo»).
- Симулятор для скриншотов: «SlovakGO Shots» (iPhone 17 Pro Max, iOS 27.0), UDID `8FEB2266-7D1E-4AA1-B4E2-7704F98F5407`, в нём выполнен вход под демо-аккаунтом.
- Сборка для симулятора: `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios-build/simulator CODE_SIGNING_ALLOWED=NO build`
- Vercel CLI здесь не авторизован (`vercel whoami` → Not authorized). GitHub CLI авторизован (`kenoleeee`).
- Загрузить файлы в App Store Connect через встроенный браузер агента нельзя: Apple блокирует файлы в обход системного окна выбора файлов. Скриншоты загружает человек, либо нужен App Store Connect API key.

## Правила для агента
- Не вводить пароли, банковские и налоговые данные, не делать юридических заявлений от имени владельца (Content Rights, App Privacy, договоры).
- Не вливать PR и не пушить в `main` без явного согласия владельца: это боевой сайт.
- Контент уроков подчиняется `AGENTS.md` в корне репозитория.
