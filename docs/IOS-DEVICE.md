# Запуск SlovakGO на iPhone

Рабочая ветка: `feat/ios-device-build`. Bundle ID: `sk.slovakgo.app`.

Это первая сборка для разработки на устройстве, с локально упакованным интерфейсом React и нативным контейнером Capacitor 8.5.3. Она не требует запущенного Vite-сервера или нахождения Mac и iPhone в одной Wi-Fi сети после установки. Интернет нужен для входа и загрузки уроков.

## Быстрый запуск

В корне проекта:

```sh
npm ci
npm run ios:open
```

1. Подключить iPhone к Mac, разблокировать и подтвердить доверие компьютеру.
2. Если iOS/Xcode запросит Developer Mode, включить его в настройках iPhone и выполнить предложенную перезагрузку.
3. В Xcode выбрать схему `App` и свой iPhone как destination.
4. В Signing & Capabilities выбрать свою Team и оставить Automatically manage signing. На этом Mac Debug Team уже задана локально в игнорируемом `ios/Signing.local.xcconfig`.
5. Нажать Run (⌘R). Если iPhone запросит доверие профилю разработчика, подтвердить его в системных настройках.

`ios/App/App.xcodeproj` — проект для Xcode. Используется Swift Package Manager; устанавливать CocoaPods не требуется.

Альтернатива из терминала:

```sh
npm run ios:devices
npm run ios:run -- --target <identifier-from-device-list>
```

Чтобы обновить приложение после изменения React-кода, снова выполнить `npm run ios:sync`, затем Run в Xcode. Простая пересборка в Xcode без sync не обновляет встроенные веб-ресурсы.

## API и сессия

По умолчанию native-сборка обращается к `https://app.slovakgo.sk/api`, то есть к существующему production API. Действия вошедшего пользователя сохраняют реальные данные его аккаунта. Для проверки использовать свой тестовый аккаунт.

Для отдельного staging API:

```sh
IOS_API_BASE_URL=https://staging.example.com/api npm run ios:sync
```

Адрес компилируется в приложение. Перед сменой окружения выйти из аккаунта и очистить данные приложения/переустановить его, чтобы не смешивать локальный прогресс разных серверов. URL должен быть HTTPS без credentials, query и fragment.

Включён CapacitorHttp: `fetch` использует нативный HTTP transport и хранилище cookie URLSession. HttpOnly-сессия остаётся на серверном cookie-механизме. Веб-CORS и серверные cookie не ослаблялись. Фактическую сохранность авторизации после закрытия приложения ещё нужно проверить с тестовым аккаунтом на устройстве.

## Что проверять в первой сборке

- Вход по email/паролю и регистрация, onboarding, загрузка учебного пути.
- Урок, словарь, практика, сохранение прогресса, выход и повторный вход.
- Закрытие/повторный запуск, отсутствие сети и отправка очереди после возвращения сети.
- Клавиатура, safe area, звук, нижняя навигация и возврат из внешнего браузера.

## Границы этой сборки

- Google OAuth пока скрыт в native UI; Sign in with Apple ещё не подключён. Для аккаунта, созданного только через Google, нужен следующий этап native-авторизации; не следует ожидать входа по несуществующему паролю.
- Покупки Apple ещё не подключены. Native-клиент не создаёт Stripe Checkout: вместо этого показывает сообщение о тестовой версии. Действующий Plus определяется сервером после входа. Управление существующей веб-подпиской открывается отдельно от WebView.
- Нативные локальные напоминания подключены, включая разрешение iOS и кнопку тестирования. Удалённые push подготовлены, но выключены до подключения платного Developer Program и APNs. Подробности: [IOS-EXPERIENCE.md](IOS-EXPERIENCE.md). Веб service worker и PWA-установка в контейнере отключены. Веб-аналитика Vercel и инициализация Meta Pixel не запускаются; внутренние события активности приложения остаются.
- Это не подписанный архив для App Store/TestFlight. Для публикации остаются этапы из `APP-STORE-RELEASE.md`, включая проверку privacy и платежей.

## Локальная проверка

```sh
npm test
npm run lint
npm run build
npm run ios:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios-build/simulator CODE_SIGNING_ALLOWED=NO build
```

Результат simulator-сборки: `ios-build/simulator/Build/Products/Debug-iphonesimulator/App.app`.

Для сборки под физический телефон выбрать device destination в Xcode. Подпись выполняется Apple Development сертификатом и provisioning profile выбранной Team; simulator `.app` на iPhone не устанавливается.

## Проверено 26 октября 2026

Обновление от 27 октября: новая сборка установлена и запущена на iPhone 15 Pro; теперь подключены локальные уведомления, адаптация темы/языка и мобильного интерфейса. Проверка и ограничения описаны в [IOS-EXPERIENCE.md](IOS-EXPERIENCE.md). Сведения ниже относятся к первоначальной сборке.

- 247 тестов в 20 файлах, ESLint, web build и native build проходят.
- Xcode Debug build прошёл для Simulator и generic iOS device. Подписанная сборка для телефона: `ios-build/device/Build/Products/Debug-iphoneos/App.app`; `codesign --verify --deep --strict` прошёл.
- Приложение установлено и запущено в iPhone 17 Simulator; экран входа отображается корректно. Снимок: `output/ios/ios-login.png`.
- Нативный HTTP bridge получил успешный ответ существующего API. Вход с реальным аккаунтом и сохранение сессии после перезапуска требуют проверки на iPhone.
- На физический iPhone приложение в рамках этой подготовки не устанавливалось.
