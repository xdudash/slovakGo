# App Privacy — проект ответов для iOS 1.0 (1)

Подготовлено 7 ноября 2026 по коду `feat/ios-in-app-purchases`. Это проект анкеты для проверки владельцем, не опубликованная декларация. Предыдущий краткий список в `output/app-store-business-todo.md` неполон: он не учитывал профиль, персонализацию и маркетинговые письма по согласию.

## Основные ответы

- Collect data: Yes.
- Privacy Policy URL: `https://www.slovakgo.sk/privacy`. Перед публикацией проверить, что URL доступен без авторизации и возвращает сам текст политики; страница находится в PR #28 и требует деплоя.
- User Privacy Choices URL: можно оставить пустым. Настройки согласия и удаление аккаунта доступны внутри приложения.
- Tracking: No — для текущей native-сборки. Meta Pixel и Vercel web analytics не инициализируются в native; Meta дополнительно ограничен публичными web-hostnames. В сборке push выключен. Маркетинговые письма сами по себе не являются межсервисным tracking.
- Для всех перечисленных ниже типов: Linked to user = Yes; Used for tracking = No. Данные авторизованных запросов связаны с `user_id`; диагностические записи также могут содержать пользователя и IP. Отдельно заявлять их анонимность оснований нет.

## Предлагаемые типы и цели

| Тип Apple | Цели | Основание в коде |
| --- | --- | --- |
| Contact Info → Name | App Functionality; Developer’s Advertising or Marketing | Регистрация, профиль и рейтинг; имя используется в письмах по согласию (`api/_lib/auth.ts`, `api/_lib/user.ts`, `api/cron/lifecycle.ts`). |
| Contact Info → Email Address | App Functionality; Developer’s Advertising or Marketing | Вход, восстановление доступа, поддержка и письма по согласию (`api/_lib/auth.ts`, `api/_lib/user.ts`, `api/cron/lifecycle.ts`). |
| Identifiers → User ID | App Functionality; Analytics; Developer’s Advertising or Marketing | Аккаунт, покупки, прогресс; события и активность связаны с ID; очередь маркетинговых писем индексируется по ID (`api/_lib/core.ts`, `api/_lib/activity.ts`, `api/cron/lifecycle.ts`). |
| Purchases → Purchase History | App Functionality | Статус подписки и проверенные транзакции Apple (`api/_lib/apple.ts`). Данные карты разработчик не получает. |
| Usage Data → Product Interaction | App Functionality; Analytics; Product Personalization; Developer’s Advertising or Marketing | Уроки, XP, ошибки упражнений, события и продолжительность занятий; персонализация учебного пути; письма подбираются по активности/прогрессу (`api/_lib/sync.ts`, `api/_lib/user.ts`, `api/_lib/activity.ts`, `src/services/analytics.ts`, `api/cron/lifecycle.ts`). |
| User Content → Customer Support | App Functionality | Форма поддержки отправляет email, имя, ID и сообщение через Resend (`api/_lib/user.ts`). Заявляем явно, не полагаясь на исключение для добровольных обращений. |
| User Content → Other User Content | App Functionality; Product Personalization; Analytics | Цель обучения редактируется как свободный текст, синхронизируется, влияет на рекомендации и передаётся в событии onboarding (`src/features/student/Onboarding.tsx`, `src/features/student/StudentScreens.tsx`, `api/_lib/sync.ts`). |
| Location → Coarse Location | App Functionality | Страна в профиле и региональный фильтр рейтинга (`api/_lib/sync.ts`, `api/_lib/user.ts`, `src/features/student/StudentScreens.tsx`). Это консервативная классификация вручную указанной страны, GPS приложение не запрашивает. |
| Diagnostics → Crash Data | App Functionality | Сообщения и stack traces ошибок, включая React ErrorBoundary и необработанные исключения (`src/components/ErrorBoundary.tsx`, `src/main.tsx`, `api/_lib/user.ts`). |
| Diagnostics → Other Diagnostic Data | App Functionality | Диагностические URL, User-Agent и IP, сохранённые в `client_errors` (`api/_lib/user.ts`). |

Не добавлять без нового основания: Payment Info, Contacts, Photos or Videos (аватар выбирается из набора, загрузка фото не реализована), Audio Data (воспроизведение звука не является записью голоса), Precise Location, рекламный Device ID. Если включить push или добавить SDK, повторно проверить типы.

Маркетинг по согласию действительно реализован: `email_preferences.marketing_consent`, повторная проверка согласия перед отправкой и ссылка отписки (`api/_lib/emailPreferences.ts`, `api/cron/lifecycle.ts`). Если эта обработка меняется перед релизом, обновить цели в таблице. Не считать только отсутствие рекламного SDK доказательством отсутствия маркетинга.

## Проверка App Review

7 ноября 2026 на странице версии проверено:

- Демо-логин `premium-test@example.com` указан; поле пароля заполнено. Пароль не читался и не копировался в документы; работоспособность входа ещё нужно проверить на iPhone.
- Контактные имя/фамилия, телефон и email заполнены. Частные контакты в этот документ не копируются.
- Review Notes содержат назначение приложения, языки, демо-аккаунт, бесплатные 10 уроков, подписки, восстановление покупок и удаление аккаунта.
- Сборка 1.0 (1) выбрана и сохранена в версии; ручной выпуск выбран.
- Перед отправкой: проверить на устройстве вход, доступ к полной функциональности для ревьюера, покупку/восстановление и актуальность заявлений «первые 10 уроков» и «A0–C2» относительно реально опубликованного контента. Наличие заполненных полей не доказывает эти сценарии.
- Серверная обработка Apple-покупок и `/privacy` ещё требуют production-деплоя PR #28. На review не отправляли.

## Источники Apple

- [App Privacy Details — типы данных, цели, связь с пользователем и tracking](https://developer.apple.com/app-store/app-privacy-details/)
- [Manage app privacy — обязательный URL политики и публикация](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)

Классификация в таблице — вывод из кода по определениям Apple. Владелец проверяет соответствие фактической серверной обработке и подрядчикам перед публикацией анкеты.
