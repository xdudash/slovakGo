# SlovakGO iOS → App Store: передача задач

Состояние на 7 ноября 2026. Документ для следующего агента или разработчика. Что уже сделано и что осталось, со всеми ID и путями.

## Коротко

SlovakGO — React/Vite PWA (уроки словацкого для украинцев), обёрнутое в iOS-приложение на Capacitor 8. В iOS подписка Plus продаётся только через App Store In-App Purchase (StoreKit 2); веб продолжает продавать через Stripe. Код готов и проверен тестами. Страница в App Store Connect заполнена. В TestFlight сборки 1.0 (1) и 1.0 (2), обе готовы к тестированию. Договор Paid Apps активен. Осталось: влить PR #28 (деплой сервера покупок и страницы политики), App Privacy, скриншоты подписок для review, тест покупки, переключить версию на build 2 и отправить на review.

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
- App Review Information: демо-логин, поле пароля, имя, фамилия, телефон, email и заметки заполнены (проверено 7 ноября). Пароль не копировался; успешный вход ещё нужно проверить на устройстве. Сборка 1.0 (1) выбрана и сохранена в версии.
- TestFlight: внутренняя группа `SlovakGO Internal`, ID `81527c43-03ed-4da4-a66d-931cc181a27b`; сборка 1.0 (1) добавлена, статус «Готово к тестированию». Автоматическая выдача будущих сборок выключена.
- С явного согласия пользователя отправлено приглашение App Store Connect на его Apple ID, роль Marketing, только SlovakGO. Приглашение App Store Connect принято. Пользователь добавлен в `SlovakGO Internal`, TestFlight подтвердил статус «Приглашен(а)». 7 ноября пользователь подтвердил: SlovakGO установлено через TestFlight и открылось на iPhone. Вход, урок и покупки ещё не проверены. Не расширять доступ другим приложениям.
- App Privacy: подробный проект ответов и основания по коду в `docs/APP-PRIVACY-DRAFT.md`; анкета ещё не опубликована. Он заменяет старый краткий перечень данных из письма владельцу.

## Что осталось

### Только владелец (агенту нельзя: юридические заявления, финансы, пароли)
Готовое письмо: `output/app-store-business-todo.md`.
1. **Business → Paid Apps Agreement**: **Active** (проверено 7 ноября, позже в тот же день). Банк Active, W-8BEN-E и Certificate of Foreign Status Active, DSA и DAC7 Active. Пункт закрыт; sandbox-покупки теперь возможны.
2. **App Information → Content Rights**: выполнено, ответ «No» подтверждён на странице.
3. **App Privacy**: проверить и опубликовать ответы из `docs/APP-PRIVACY-DRAFT.md` и URL политики после деплоя. Старый список в письме неполон; в коде есть маркетинговые письма по согласию, персонализация, страна профиля и диагностика.
4. **App Review Information**: заполнено; проверить вход демо-аккаунта на устройстве.
5. **App Store Small Business Program** (15% вместо 30%).
6. **Sandbox Tester** (Users and Access → Sandbox) для теста покупки.

### Для агента
1. Иконка и документ передачи добавлены в `feat/ios-in-app-purchases`; проверить результаты CI после push.
2. **Деплой:** проверить Vercel preview PR #28 (`/privacy` на лендинге, `GET /api/ping`, `GET /api/billing/apple/account` → 401 без сессии), затем с согласия владельца влить PR в `main`.
3. **Подпись сборки исправлена 7 ноября 2026.** В Xcode добавлен Apple ID с командой World Work `6TU82NKL53` (Admin, доступ Certificates, Identifiers & Profiles). Локальный `ios/Signing.local.xcconfig` указывает на эту команду. Экспортирован `ios-build/app-store/App.ipa`, версия 1.0 (1): подпись проверена `codesign --verify --deep --strict`, TeamIdentifier `6TU82NKL53`, App Store provisioning profile для `sk.slovakgo.app`. Push в приложении по-прежнему выключен.
4. **Сборка и TestFlight:** сборка **1.0 (3)** (коммит `73b3f4e`: фирменные цвета, заставка, локализованный пейвол, Sign in with Apple) загружена 7 ноября в 06:48 командой `xcodebuild -exportArchive` с `/tmp/slovakgo-build3-upload.plist` (на этот раз без ошибки прав) и добавлена в `SlovakGO Internal`. Ранее в TestFlight были две сборки, обе «Ready to Submit» и в группе `SlovakGO Internal`: **1.0 (1)** (загружена 02:28) и **1.0 (2)** (загружена 04:06, с доработками дизайна из коммита `49c318d`; архив `ios-build/SlovakGO-2-final-signed.xcarchive`). Загрузка build 2 через `xcodebuild -exportArchive` упала с «You do not have required role or permission» (`/tmp/slovakgo-build2-upload.log`); затем её загрузили вручную через Xcode. **В версии 1.0 выбрана сборка 1, перед отправкой на review переключить на 2.** Следующая загрузка — build number 4 или выше. **Перед отправкой на review выбрать в версии 1.0 сборку 3.**
   - Боевой сервер ещё без кода PR #28: `https://app.slovakgo.sk/api/billing/apple/account` → 404, `https://www.slovakgo.sk/privacy` → 404. Пока PR не влит, покупка в TestFlight не будет засчитана сервером, а URL политики для App Privacy не работает.
   - Подписки в статусе «Prepare for Submission»: не хватает скриншота экрана покупки (Review Information → Screenshot) у каждой.

   Команды для повторной сборки:
   ```sh
   npm ci && npm run ios:sync
   xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
     -destination 'generic/platform=iOS' -archivePath ios-build/SlovakGO.xcarchive \
     -allowProvisioningUpdates archive
   ```
   Обычный archive с automatic development signing сейчас требует зарегистрированное устройство (у World Work их 0). Проверенный путь без устройства: добавить к команде archive `DEVELOPMENT_TEAM=6TU82NKL53 CODE_SIGNING_ALLOWED=NO`, затем подписать при `xcodebuild -exportArchive` с `method=app-store-connect`, `signingStyle=automatic`, `teamID=6TU82NKL53`, `destination=export` или `upload`. Экспорт IPA успешно проверен.

   Затем загрузить через Xcode Organizer (Distribute App → App Store Connect) или `xcodebuild -exportArchive` с `method app-store-connect` и `destination upload`. Перед каждой новой загрузкой увеличивать `CURRENT_PROJECT_VERSION` (build number; уже загружен 1, `MARKETING_VERSION` 1.0).
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
