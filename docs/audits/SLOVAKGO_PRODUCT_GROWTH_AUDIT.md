# SlovakGo — аудит продукта, UX, аналитики, удержания и монетизации

**Дата:** 22.10.2026  
**Репозиторий и проверенная версия:** [xdudash/slovakGo](https://github.com/xdudash/slovakGo), main, commit 3070f6de504e7fe5700f9699a4468ec8ddccc9c5.  
**Метод:** анализ исходников, конфигурации, документации, истории изменений и статуса GitHub Actions. Production-аккаунты и production-сессии не использовались; данные пользователей не менялись.

## 1. Executive summary

По коду нельзя подтвердить, что причиной слабых регистраций в уроки, возвратов или оплат является интерфейс. Фактической воронки и поведения когорт в доступных материалах нет. Поэтому менять дизайн, цену или каналы рекламы на основании догадки сейчас рано.

Подтверждены три главных направления работы:

1. **Сначала включить измеримую воронку.** Есть серверное хранилище событий и базовые события регистрации, старта/завершения урока, paywall и оплаты, но нет достаточного набора для измерения старта регистрации, D1/D7, второго урока, ошибок оплаты и продления. Кроме того, в событиях нет зафиксированного идентификатора визита/кампании; это усложняет привязку landing → app и анализ источника регистрации. См. [analytics.ts](https://github.com/xdudash/slovakGo/blob/main/src/services/analytics.ts) и [user.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/user.ts).
2. **Проверить текущую воронку первого урока после последних изменений.** На main уже есть 10 бесплатных уроков и недавний коммит, разрешающий продолжать урок после ошибок. Это свежая гипотеза продукта, а не доказанное улучшение retention. Нужен запуск событий и сравнение когорт после релиза. См. [shared/access.ts](https://github.com/xdudash/slovakGo/blob/main/shared/access.ts) и commit 3070f6d.
3. **Уточнить эксплуатационную документацию.** README описывает PHP endpoint и JSON-файл на Hostinger, тогда как текущая архитектура использует Vercel serverless API и Turso/libSQL. Это подтверждённое противоречие, которое может привести к неправильным действиям при поддержке и восстановлении данных. См. [README.md](https://github.com/xdudash/slovakGo/blob/main/README.md), [api/index.ts](https://github.com/xdudash/slovakGo/blob/main/api/index.ts), [api/_lib/core.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/core.ts).

**Пять действий с наибольшим ожидаемым эффектом:**

1. Получить выгрузку событий и Stripe-показателей за последние 30–60 дней, посчитать воронку по неделям/источникам/устройствам.
2. Исправить пробелы аналитики и привязку анонимного визита к аккаунту; исключать админские просмотры из продуктовой аналитики, а не только из Meta Pixel.
3. Проверить на реальном телефоне путь от landing до регистрации и завершения первого урока, включая ошибки и восстановление после перезагрузки.
4. Измерить эффект текущего free preview и продолжения урока: signup → lesson_start → lesson_complete → second lesson → D1/D7 → paywall → checkout → paid.
5. Не запускать публикацию в магазинах и платную рекламу до появления базовых показателей конверсии, активации и оттока.

## 2. Проверенные факты и недостающие данные

### Подтверждено исходниками

- Frontend: React 19, Vite, TypeScript, React Router, Zustand; отдельный Astro-проект landing в каталоге landing. Зависимости и команды перечислены в [package.json](https://github.com/xdudash/slovakGo/blob/main/package.json).
- API: Vercel Serverless Functions с единым роутером [api/index.ts](https://github.com/xdudash/slovakGo/blob/main/api/index.ts).
- Database: Turso/libSQL. Production требует TURSO_DATABASE_URL; используется TURSO_AUTH_TOKEN. См. [api/_lib/core.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/core.ts).
- Auth: email/password и Google OAuth; серверные обработчики в [api/_lib/auth.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/auth.ts). Клиентский session state хранится локально, API использует cookie sl_session; см. [src/store/useAppStore.ts](https://github.com/xdudash/slovakGo/blob/main/src/store/useAppStore.ts) и [api/_lib/core.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/core.ts).
- Прогресс: локальное сохранение и очередь синхронизации; очередь восстанавливается из IndexedDB и отправляется через API. См. [syncService.ts](https://github.com/xdudash/slovakGo/blob/main/src/services/syncService.ts), [progressService.ts](https://github.com/xdudash/slovakGo/blob/main/src/services/progressService.ts), [useAppStore.ts](https://github.com/xdudash/slovakGo/blob/main/src/store/useAppStore.ts).
- Монетизация: Stripe Checkout/подписки. Сервер проверяет, что активная цена равна €3 в месяц или €20 в год, и требует подтверждения условий. Триал — 3 дня. Значения заданы в [api/_lib/stripe.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/stripe.ts). Это проверка кода, не подтверждение актуальных цен в Stripe Dashboard.
- Уровень доступа: 10 бесплатных уроков по коду; проверка основана на числе опубликованных завершённых уроков. См. [shared/access.ts](https://github.com/xdudash/slovakGo/blob/main/shared/access.ts).
- В дереве main находится 1020 файлов уроков: A0 — 60, A1 — 180, A2 — 200, B1 — 200, B2 — 180, C1 — 120, C2 — 80. Это количество файлов в репозитории, не число опубликованных или реально доступных в production уроков.
- PWA имеет manifest, иконки, offline страницу, service worker, кэширование оболочки и аудио, а также FCM. См. [manifest.webmanifest](https://github.com/xdudash/slovakGo/blob/main/public/manifest.webmanifest), [sw.js](https://github.com/xdudash/slovakGo/blob/main/public/sw.js), [offline.html](https://github.com/xdudash/slovakGo/blob/main/public/offline.html).
- GitHub Actions Full App CI для текущего main commit 21.10.2026 завершился успешно. Workflow включает npm test, npm build и сборку landing: [ci.yml](https://github.com/xdudash/slovakGo/blob/main/.github/workflows/ci.yml), [run 39548371969](https://github.com/xdudash/slovakGo/actions/runs/39548371969).
- Есть один открытый PR: “Reset landing to a restrained 2026 system” (#14), обновлялся 25.09.2026. Его актуальность и конфликт с текущим дизайном следует сверить с владельцем перед использованием.

### Недоступно в этой проверке

Не получены: таблица events, пользовательская активность, когортные показатели, рекламные UTM/расходы, Stripe Dashboard и webhook delivery health, логи Vercel/Turso, production-консоль и network waterfall, Android/iOS фактическая установка. Поэтому ниже нет утверждений о реальной конверсии, churn, ошибках пользователей, Core Web Vitals или отказах оплаты.

## 3. Текущая архитектура и пользовательский путь

Landing размещается отдельно от app: Astro landing ведёт на https://app.slovakgo.sk/register?lang=…; см. [Home.astro](https://github.com/xdudash/slovakGo/blob/main/landing/src/components/Home.astro). Landing содержит интерактивное демо. App содержит регистрацию, onboarding, placement test, путь, lesson, vocabulary/practice и paywall. Студенческие маршруты объявлены в [StudentScreens.tsx](https://github.com/xdudash/slovakGo/blob/main/src/features/student/StudentScreens.tsx); регистрация в [AuthScreens.tsx](https://github.com/xdudash/slovakGo/blob/main/src/features/auth/AuthScreens.tsx).

Путь по коду: landing/demo → регистрация или вход → onboarding/placement → путь → урок → локальное завершение и синхронизация → бесплатное продолжение до лимита → paywall → Stripe Checkout → подтверждение сервером через webhook. Код checkout и webhook: [stripe.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/stripe.ts). Реальный проход браузером на production не выполнялся.

External services: Vercel (web/API/cron), Turso/libSQL (данные), Stripe (платежи), Firebase Cloud Messaging (push), Google OAuth, Meta Pixel/Conversions API. Vercel cron указан в [vercel.json](https://github.com/xdudash/slovakGo/blob/main/vercel.json). Сокращать сервисы без оценки влияния не рекомендую; платёжный провайдер и основная база критичны, Pixel и push можно временно отключить без блокировки уроков, но с потерей рекламы/возвратных каналов.

## 4. UX/UI-аудит с конкретными местами в коде

Это статический аудит кода. Пункты ниже — проверяемые свойства кода или риски, а не наблюдения из реального пользовательского сеанса.

| Место | Фактическое поведение / риск | Ожидаемое поведение и шаг проверки | Приоритет |
|---|---|---|---|
| landing/src/components/Home.astro → /register | Основные CTA ведут прямо на регистрацию; demo доступно отдельно ниже по странице. Короткий путь к аккаунту подтверждён кодом, но это может прервать пользователя до знакомства с продуктом. | На телефоне пройти landing с рекламной ссылки. Сравнить CTA регистрации с CTA демо и продолжением демо в регистрации; решение принимать по завершению первого урока, а не только CTR. Это гипотеза о трении. | P1 |
| src/features/auth/AuthScreens.tsx | Email signup отправляет данные на сервер, после регистрации пользователь направляется в postAuthRoute. Форма и ошибки требуют визуальной проверки на узком экране. | Тест 320–390 px: автозаполнение, показ ошибок, клавиатура, восстановление после сетевой ошибки, Google OAuth return и сохранение языка. | P1 |
| src/features/student/StudentScreens.tsx: PathScreen, LessonScreen | Старт урока и завершение отправляют события; завершение показывает результат и обновляет прогресс. Код содержит lesson draft/resume. | Провести первый урок без подсказок, перезагрузить вкладку на середине и после завершения, войти на другом устройстве и убедиться, что следующий урок правильный. Не удалось подтвердить в браузере. | P1 |
| src/features/student/StudentScreens.tsx: PaywallScreen | Paywall появляется по условиям доступа; после завершения free preview можно открыть предложение. Checkout создаётся backend и включает acceptTerms. | Проверить, что цена, периодичность, пробный срок, автопродление и отмена видны до отправки на Stripe, на всех языках и размерах экрана. Код подтверждает price validation, но не видимость/понятность копирайта. | P1 |
| public/offline.html и syncService.ts | Offline экран обещает сохранение прогресса и синхронизацию. Для уже авторизованного пользователя очередь предусмотрена, но регистрация/вход/checkout требуют сети. | Принудительно отключить сеть на каждом ключевом шаге и убедиться, что сообщение не обещает сохранить действие, которое не было записано локально. | P2 |

PRODUCT.md задаёт WCAG AA, контраст body текста ≥4.5:1, touch target ≥44 px, reduced motion. Это требования, а не результаты проверки соответствия. Нужен автоматический и ручной mobile accessibility проход: фокус, screen reader labels, контраст состояний disabled/error, клавиатурная навигация.

## 5. Аналитика и доступные показатели воронки

Клиентские события объявлены в [analytics.ts](https://github.com/xdudash/slovakGo/blob/main/src/services/analytics.ts), отправляются пакетами через POST /events. Backend принимает события сессий и без сессии и сохраняет таблицу events в [user.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/user.ts). Серверные Stripe события логируются в [stripe.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/stripe.ts).

| Шаг | В коде | Комментарий |
|---|---|---|
| landing_view | Не найдено в app tracker | Landing имеет собственный JS tracker; нужен доступ к фактическому destination и отчётам. |
| signup_started | Не найдено | Нельзя посчитать долю посетителей, открывших форму регистрации. |
| signup_completed | Есть как register | Email и Google; названия не совпадают с предложенной схемой. |
| lesson_started | Есть как lesson_start | Включает lessonId и level. |
| lesson_completed | Есть как lesson_complete | Есть first, correct, total. |
| second_lesson_completed | Не найдено отдельно | Можно восстановить по последовательным событиям, если user_id и порядок событий пригодны. |
| return_day_1 / return_day_7 | Не найдены | Лучше рассчитывать когорты по first_seen и активности, а не ставить событие на клиентский таймер. |
| paywall_viewed | Есть как paywall_view | Код исключает admin preview при отправке этого события. |
| checkout_started | Есть как checkout_start | Вызовы в Paywall/Shop.
| subscription_started | Есть trial_start и paid | Семантика отличается; trial не равен первому успешному платежу. |
| subscription_renewed | Не найдено в logEvent | webhook invoice.paid/payment_succeeded обрабатывается, но воронка renewal не записывается. |
| subscription_cancelled | Есть churn только при subscription.deleted | Не измеряет запрос отмены, scheduled cancellation и причину. |
| payment_failed | Обработчик webhook существует | Событие в таблицу событий не добавляется; измерить частоту по этому хранилищу нельзя. |

Критичные ограничения: track() всё равно кладёт событие в очередь внутри admin preview; admin-return исключает Meta Pixel, но не события API. Это может загрязнять app funnel административными проверками. Browser события хранятся без явного session_id, event_id или idempotency key; server events имеют отдельный путь. Повторные отправки после unload/visibility change нужно проверить на дубль. События сами по себе не являются метриками: число событий нельзя считать числом пользователей.

**Минимальная схема для решения задачи:** visit_id, user_id после регистрации, event_id, event_time UTC, route, locale, device class, campaign/source/medium/content, lesson_id/level, subscription plan, server-side payment/invoice ID. Для privacy — минимизировать параметры, не отправлять email/пароли/свободный текст ответов, определить срок хранения и согласия. Связать анонимный visit_id с аккаунтом после регистрации. Серверные платежные события должны быть источником истины для paid/revenue.

Запросить выгрузку событий по когортам: неделя регистрации × source × mobile/desktop, затем уникальные пользователи и конверсии, а не общее число строк. На первом этапе достаточно SQL/CSV без новой платной аналитической платформы.

## 6. Активация и retention

Самый полезный ранний activation event — первый завершённый урок; в коде для Meta отмечается FirstLessonComplete при props.first=true. Сейчас нет отдельно измеряемого завершения второго урока и возврата D1/D7. Поэтому утверждение “большинство пользователей бросают после 1–2 уроков” требует проверки по server events и уникальным user_id.

Гипотезы для испытания:
- регистрация до демо/первой практики увеличивает раннее трение;
- onboarding/placement test добавляют шаги до полезного результата;
- настройка следующего шага или прогресс-сохранение могут теряться в интерфейсе;
- напоминания, XP/streak и free continuation могут повысить возвраты, но только если полезность уроков уже ясна.

Эксперимент: начать с одного изменения за раз. Сравнить новую когорту с контрольной по доле завершения первого урока в течение 24 часов, второго урока за 7 дней, D1/D7 и paid conversion. Не использовать CTR рекламы как замену активации. При малой выборке считать интервалы неопределённости и не объявлять победителя по нескольким конверсиям.

Для выявления причин ухода нужны качественные данные: 5–8 коротких тестов с новыми украиноговорящими учащимися и просмотром их экрана; либо необязательный вопрос после закрытия урока. Из исходников не узнать, был ли урок слишком длинным, непонятным, неуместным или пользователь просто отвлёкся.

## 7. Качество учебного продукта

Репозиторий содержит широкую библиотеку — 1020 JSON-уроков по A0–C2. Есть curriculum architecture, JSON/runtime contracts и отдельный QA-процесс; см. [COURSE_ARCHITECTURE_V2.md](https://github.com/xdudash/slovakGo/blob/main/curriculum/COURSE_ARCHITECTURE_V2.md) и [AGENTS.md](https://github.com/xdudash/slovakGo/blob/main/AGENTS.md). Последний файл в основном регламентирует создание учебного контента, а не общее сопровождение приложения.

Код содержит 35 новых типов упражнений и отдельные компоненты для выбора, сопоставления, диалогов, listening и т. п. Само наличие компонентов не подтверждает естественность языка, правильность ответов, соответствие CEFR или корректность всех 1020 уроков. Нужны существующие qa:lessons и sampled human QA на опубликованных уроках, особенно первые 10 и уроки, где высокая доля ошибок/выходов.

Минимальный контент-аудит: взять 10 первых опубликованных уроков и 10 уроков с наибольшим dropout/error rate; сверить цель, инструкции, сложность, допустимые ответы, перевод, мобильный rendering и длину. Сначала использовать данные по учебному поведению, чтобы не пересматривать тысячу файлов без приоритета.

## 8. Монетизация и платежный путь

Stripe Checkout создаётся сервером. Проверяется цена/период, checkout привязывается к user id, Webhook валидирует подпись. Доступ меняется по данным webhook и состояния подписки; это хорошие защитные слои в коде. См. [stripe.ts](https://github.com/xdudash/slovakGo/blob/main/api/_lib/stripe.ts).

Риски, которые следует проверить на тестовом Stripe account: повторный webhook delivery, задержка/порядок checkout и subscription.updated, отмена до конца периода, неуспешное продление, возврат, истёкший trial, успешная оплата при неуспешном возврате пользователя на success URL. Не проводить живые платежи или менять настройки Stripe во время аудита.

Конкретный пробел наблюдаемости: webhook обрабатывает invoice.payment_failed, но не записывает payment_failed в таблицу событий. Аналогично invoice.paid не пишется как renewal. Поэтому платёжная ошибка/повторное списание не видны в funnel events; запросить Stripe Dashboard/invoice данные владельца. Не выводить долю отказов из отсутствия события.

## 9. PWA против Google Play и App Store

Текущие PWA возможности: manifest и иконки, standalone display, service worker, offline app shell, offline.html, кэширование статических файлов и аудио, FCM integration, install banner для Android и инструкции установки для iOS. Поддержка в реальных браузерах/устройствах не проверялась.

**Решаемо в PWA:** улучшить first-run, push permission timing, offline resume, deep links/маршруты, скорость, install prompt, данные о возврате. Выход в store не нужен для этих задач.

**Что зависит от ограничений платформ:** установка на iOS требует пользовательского действия через системное меню; браузерные push/in-app возможности различаются; браузерная PWA не даёт store listing и магазинную дистрибуцию. Проверить актуальное поведение отдельно на iOS Safari и Android Chrome.

**Google Play:** может дать поисковое присутствие и обычную установку из магазина, но требует Android package, сборки/подписи, listing, Data safety, тестирования устройств и поддержки release pipeline. Google указывает US$25 однократную регистрацию разработчика: [Play Console Help](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en).
**App Store:** добавит магазинное обнаружение и TestFlight, но понадобится native shell или подходящая обёртка, review, регулярные билды и поддержка iOS. Apple Developer Program стоит US$99 в год (локальная цена может отличаться): [Apple Developer Program](https://developer.apple.com/programs/).

Если продавать цифровую подписку внутри native приложения, сначала проверить действующие требования магазина к in-app billing и комиссии для Словакии/ЕЭЗ. Это может увеличить сложность и стоимость по сравнению с прямым Stripe checkout. Само размещение не гарантирует retention или продажи. Решение о публикации принимать после измерения доли iOS/Android, установок PWA, органического спроса и потерь на этапе установки.

## 10. Технические ошибки и риски

- **Подтверждено — документация backend устарела.** README описывает PHP endpoint, Hostinger и public/api/storage/state.json; текущий backend — Vercel API и Turso. Исправить README и добавить краткую схему production источников истины. P1.
- **Подтверждено — нет production данных и live smoke test.** Нельзя подтвердить, что app.slovakgo.sk и Stripe реально настроены по текущей конфигурации. Это ограничение аудита, не найденный production-инцидент.
- **Подтверждено — CI проходит на HEAD.** Run от 21.10.2026 показывает success для текущего main. В локальной среде тесты, lint и build не запускались, потому что repository checkout отсутствует. CI workflow включает test/build и landing build; lint не указан в workflow.
- **Проверить — лишние client events.** Admin preview отсекает Meta события, но app tracker продолжает очередь событий. Это способно портить продуктовые метрики, хотя не влияет на пользовательский доступ.
- **Проверить — синхронизация при сети и между устройствами.** В коде есть очереди, owner scoping и recover. Нужен реальный тест с offline lesson completion, повторным login, двух устройствах и повторной доставкой mutation.
- **Не применимо — Supabase RLS.** По коду используется Turso/libSQL, а не Supabase. Проверять нужно API authorization и SQL endpoint access, не RLS.
- **Проверить — секреты и настройки deployment.** .env.example перечисляет необходимые конфигурации, но секреты/Vercel env не просматривались. Не помещать значения в аудит или issues.

Надёжность подтверждена частично: кодовые тесты и CI есть, но E2E, live payments, production logs, accessibility и web vitals не подтверждены.

## 11. Модель достижения 100 активных платных подписок

Текущие conversion/churn неизвестны. Таблица ниже — иллюстрация, не прогноз. Для расчёта нужен target: 100 действующих подписок на конец 12-го месяца, равномерное добавление новых подписчиков и условный ежемесячный отток 5%.

При этих допущениях требуется около 10.3 новых платных подписчиков в месяц, чтобы после 12 месяцев выйти на 100 действующих. Формула: месячный приток × (1 − (1 − churn)^12) / churn = 100.

| Визит → платная подписка (допущение) | Визитов в месяц для ~10.3 новых оплат |
|---:|---:|
| 0.1% | ~10 300 |
| 0.5% | ~2 060 |
| 1.0% | ~1 030 |

Если отток окажется 10% в месяц, для цели на 12-й месяц понадобится около 14.7 новых подписок ежемесячно. При 5% monthly churn, уже имея 100 активных, нужно около 5 новых оплат/месяц только для удержания размера базы. Подставлять реальные значения можно только после получения Stripe + funnel data.

Сначала недорогие каналы:
- Органический поиск: landing/blog уже есть. Отслеживать qualified landing visits → signup → first lesson; прекратить расширение контента, если страницы не приводят целевых регистраций после достаточного периода индексирования.
- Instagram/TikTok: короткие практические ситуации и словарь, один CTA/ссылка с UTM на формат. Оценивать не просмотры, а завершение первого/второго урока и стоимость активированного учащегося.
- Рефералы: код и бонус за фактически оплатившего реферала существуют в коде. Измерять долю activated referred users, paid conversion и стоимость bonus-days; проверить fraud и качество привлечения.
- Возврат уже зарегистрированных: email preferences, reminders/cron, FCM предусмотрены. Измерять incremental D7/D30 и отписки; не отправлять напоминания тем, кто отключил согласие.
- Платная реклама: запускать малым лимитом только после server-side paid tracking и связи source→paid. Останавливать креатив/канал по заранее заданному пределу стоимости активированного подписчика, а не по дешёвому клику.

## 12. План действий на 30, 60 и 90 дней

### Первые 30 дней — наблюдаемость и базовая проверка
1. Экспортировать события и Stripe показатели; построить базовую когорту 30–60 дней.
2. Добавить/нормализовать event_id, visit_id и campaign attribution; проверить dedupe, consent и исключение admin preview.
3. Дополнить подписочную воронку payment_failed, invoice_paid/renewal, cancel_requested/cancelled; сверить server events с Stripe.
4. Провести mobile walkthrough на iOS Safari и Android Chrome: landing, signup, first lesson, resume, paywall, Stripe test mode.
5. Обновить README/архитектурную документацию согласно Vercel + Turso.

### До 60 дней — устранить подтверждённые точки трения
1. Выбрать один крупнейший измеренный провал воронки и сделать адресное изменение.
2. Проверить первые уроки на понятность и мобильный render; исправить только подтверждённые дефекты.
3. Провести 5–8 наблюдаемых usability sessions с новыми пользователями и сопоставить наблюдения с событиями.
4. Запустить один измеримый возвратный канал или реферальный тест.

### До 90 дней — масштабирование того, что доказало эффект
1. Повторить/расширить варианты, которые улучшили second lesson, D7 или paid conversion.
2. Рассчитать целевую цену привлечения по фактическому месячному/годовому доходу, комиссии, trial conversion и churn.
3. Решить, нужен ли Google Play MVP на основании Android install gap и store intent; отдельно оценить iOS.
4. Увеличивать рекламный бюджет только при работающем attribution и окупаемом paid cohort.

## 13. План экспериментов и метрики успеха

| Эксперимент | Изменение | Основная метрика | Защитные метрики |
|---|---|---|---|
| Демо перед регистрацией | CTA ведёт в демо или позволяет начать практику до signup | first lesson complete / landing visit | signup quality, return D7 |
| Упрощение onboarding | Убрать/перенести необязательный шаг, если он доказанно задерживает старт | signup → lesson_start и lesson completion | placement success, D7 |
| Текущие 10 бесплатных уроков | Сравнить когорты до/после изменения free continuation | second lesson, D7, paid conversion | revenue per visitor, support issues |
| Напоминания | Контрольная группа без напоминаний против одной согласованной отправки | incremental D7/D30 | unsubscribe, notification disable |
| Paywall clarity | Проверить понятность периода, trial, renewal и cancel | checkout start → paid | refund, dispute, cancellation |
| Store install | Только малый Android pilot после данных | install → D7 active vs PWA | release/support cost, payment drop |

Для каждого теста заранее задать аудиторию, длительность, минимально полезный эффект и условие остановки. Не считать корреляцию доказательством причины; если выборка слишком мала, использовать юзабилити-сессии и отложить статистический вывод.

## 14. Что требует доступа владельца

1. Export таблицы events (имена, props, user_id, created_at) и согласованное окно анализа.
2. Stripe Dashboard: подписки, trial-to-paid, renewals, failed payments, refunds, cancellation schedules и webhook delivery; без секретных ключей.
3. Vercel deployments/runtime logs, production env key names/status (значения не присылать), cron execution status и доменная схема.
4. Turso read-only SQL или anonymized export с пользователями/прогрессом/подпиской. Не нужен доступ на запись.
5. Analytics/Meta reports по spend, campaign, landing sessions и conversion; UTM conventions.
6. Устройство/браузер для проведения smoke test либо E2E тестовый аккаунт и Stripe test-mode flow.

## Приоритизированный список

| Приоритет | Проблема | Доказательство | Ожидаемое влияние | Сложность | Зависимости | Следующий шаг |
|---|---|---|---|---|---|---|
| P1 | Невозможно уверенно объяснить потери воронки без когортной выгрузки | Backend сохраняет events, но владелец метрик/выгрузка недоступны | Определяет реальный bottleneck вместо догадок | Средняя | Read-only доступ к event/Stripe данным | Получить выгрузку 30–60 дней и посчитать базовые коэффициенты |
| P1 | Нет отдельного измерения signup start, D1/D7, second lesson и payment failure/renewal | Сопоставление клиентских FunnelEvent и Stripe logEvent в analytics.ts/user.ts/stripe.ts | Улучшает решение о продукте и рекламном расходе | Средняя | Event schema, privacy review | Утвердить минимальную схему и добавить события/когорты |
| P1 | Админские действия могут загрязнять app event table | Admin preview не отправляет Meta Pixel, но track() ставит события в queue | Искажает регистрацию, уроки и paywall | Низкая | Правило идентификации внутренних тестов | Исключить admin preview до queue; пометить staff/test traffic |
| P1 | README описывает неактуальный backend | README: PHP/Hostinger/JSON; код: Vercel/Turso | Снижает надёжность поддержки и восстановления | Низкая | Сверить production архитектуру с владельцем | Обновить README и добавить deployment/data-flow docs |
| P1 | Реальный mobile user journey не проверен | Нет браузерного walkthrough/E2E evidence в этом аудите | Может скрывать блокирующий UX дефект перед масштабированием трафика | Средняя | iOS/Android устройства, test account | Провести сценарий signup → second lesson → test checkout |
| P2 | Открытый PR по landing может означать незавершённое изменение главного acquisition surface | PR #14 открыт, последнее обновление 25.09.2026 | Возможны устаревшая работа или конфликт дизайна | Низкая | Владелец подтверждает актуальность намерения | Проверить PR diff/status перед планированием новых изменений |
| P2 | Решение о магазинах пока не подкреплено данными | PWA есть; store listing и device split не проверены | Избегает преждевременных затрат и параллельной поддержки | Средняя/высокая | Device share, install gap, store policies | Измерить устройство/установки и только потом провести Android pilot |
| P2 | Качество первых уроков не сопоставлено с поведением учащихся | В репозитории 1020 уроков и есть QA контракт, но нет cohort/error report | Улучшает активацию там, где проблема в содержании | Средняя | Ошибки/отказы по lesson_id, преподавательская проверка | Выбрать первые 10 и уроки с худшими метриками для review |

## Ссылки

- [Repository main](https://github.com/xdudash/slovakGo/tree/main)
- [Latest CI run for audited main](https://github.com/xdudash/slovakGo/actions/runs/39548371969)
- [Open landing PR #14](https://github.com/xdudash/slovakGo/pull/14)
- [Google Play developer registration fee](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Apple Developer Program membership](https://developer.apple.com/programs/)
