# SlovakGO

Новая чистая сборка SlovakGO: mobile-first PWA для украинских пользователей, которые учат словацкий для жизни в Словакии.

## Запуск

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npm run build
```

## Тестовые аккаунты

```txt
student@slovaklife.local / password123
teacher@slovaklife.local / password123
admin@slovaklife.local / password123
```

## Что внутри

- React + Vite + TypeScript + React Router + Zustand.
- Student routes: шлях, урок, словник, тренування, рейтинг, магазин, профіль, налаштування, рівні.
- Teacher routes: огляд, уроки, редактор урока, статистика, JSON import/export.
- Admin routes: користувачі, уроки, підписки, статистика, помилки.
- JSON-first слой данных: `src/data`, `src/services`, `src/store`.
- Offline queue и sync adapter: `src/services/syncService.ts`.
- PHP JSON endpoint: `public/api/index.php`.
- PWA shell: `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`.

## PHP sync

По умолчанию фронт отправляет очередь изменений в:

```txt
/api/index.php/sync/push
```

Можно переопределить endpoint переменной:

```env
VITE_API_BASE_URL=https://example.com/api/index.php
```

PHP хранит состояние в `public/api/storage/state.json`. На Hostinger папку `storage` лучше вынести из публичного доступа или закрыть правилами сервера после подключения реального backend.
