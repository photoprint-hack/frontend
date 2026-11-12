# Компас — frontend управленческой платформы «Фотопринт»

Веб-интерфейс трека 1 хакатона: связывает KPI, продажи, заказы, производство,
финансы, персонал, прогноз и управленческий цикл «отклонение → решение → задача →
проверка результата».

Демо: [photoprint-frontend.vercel.app](https://photoprint-frontend.vercel.app).
API: [backend-v8pa.onrender.com](https://backend-v8pa.onrender.com).
Проверенный контракт: API 1.2, `snake_case`, UTC ISO-8601, `{data}` и
`{items,total,page,page_size,pages}`.

## Границы реализации

Репозиторий реализует интерфейс трека 1. Мобильное приложение PicPac (трек 2) и
AI-ассистент встреч (трек 3) в него не входят.

Интерфейс работает в трёх режимах:

| Режим | Когда нужен | Источник данных |
| --- | --- | --- |
| Production demo | Проверка опубликованной версии | Render API |
| Local API | Совместная разработка с Backend | `http://localhost:8000/api/v1` |
| Frontend mocks | Просмотр UI без Backend | Данные в памяти вкладки |

Frontend-моки предназначены только для UI-демонстрации. Созданные в них решения и
изменённые статусы исчезают после перезагрузки страницы. Для проверки сохранения,
прав, аудита и идемпотентности используйте настоящий Backend.

## Стек и архитектура

React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios,
React Hook Form, Zod, Sonner и Lucide.

Запрос проходит через route guards и feature-модуль в `lib/api/endpoints.ts`, затем
через единый HTTP-клиент в `/api/v1`. React Query хранит серверное состояние,
Access JWT — только в памяти, глобальные фильтры — в URL. Frontend-mocks реализуют
тот же транспортный интерфейс и не меняют код экранов.

Права UI повторяют серверную матрицу, но не заменяют её. Backend рассчитывает KPI,
применяет ограничения подразделения, проверяет `version`, идемпотентность и пишет
аудит.

## Быстрый запуск

Нужны Node.js и npm. Ниже команды запускаются из каталога, где лежит
`package.json`; в текущем окружении это
`Coding/other/photoprint-frontend/frontend`, а не родительский каталог
`photoprint-frontend`.

```sh
npm ci
```

### Вариант 1. Только UI, без Backend

Создайте `.env.local`:

```env
VITE_API_URL=
VITE_USE_MOCKS=true
VITE_MOCK_LATENCY=260
```

Запустите приложение:

```sh
npm run dev
```

Откройте [http://localhost:5173](http://localhost:5173). На странице входа выберите
любую роль в блоке демонстрационных аккаунтов: email и пароль подставятся
автоматически.

### Вариант 2. Локальный Backend

Сначала запустите Backend по его README. Затем создайте `.env.local`:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_USE_MOCKS=false
```

Запустите frontend:

```sh
npm run dev
```

Если Backend слушает другой порт, измените `VITE_API_URL`. Адрес должен включать
префикс `/api/v1`.

### Вариант 3. Опубликованный API

Можно использовать шаблон из репозитория:

```sh
cp .env.example .env.local
npm run dev
```

По умолчанию `VITE_API_URL` указывает на
`https://backend-v8pa.onrender.com/api/v1`. Для входа выберите демонстрационную
роль на странице входа.

## Команды

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Vite dev-сервер с HMR на `http://localhost:5173` |
| `npm run build` | TypeScript-проверка и production-сборка в `dist/` |
| `npm run preview` | Локальный просмотр содержимого `dist/` |
| `npm run typecheck` | Только `tsc --noEmit` |
| `npm run test:api` | HTTP/adapters/layout regression-тесты |

Перед сдачей изменений:

```sh
npm run test:api
npm run build
```

## Переменные окружения

| Переменная | Значение | Поведение |
| --- | --- | --- |
| `VITE_API_URL` | URL API, включая `/api/v1` | Если переменная не задана, используется опубликованный Render API. Пустая строка включает моки. |
| `VITE_USE_MOCKS` | `true` или `false` | `true`/`1` принудительно включает frontend-моки. |
| `VITE_MOCK_LATENCY` | миллисекунды | Искусственная задержка mock-ответов; по умолчанию `220`. |

Переменные Vite встраиваются во время сборки. После изменения `.env.local` или
настроек Vercel нужен новый build/deploy.

## Что покрывает трек 1

| Требование ТЗ | Реализация |
| --- | --- |
| Пульс компании | 12 KPI с фактом, планом, прогнозом, статусом, формулой, источниками и временем |
| Фильтры | Период, подразделение и продукт сохраняются в URL |
| Детализация | История KPI и разрезы по подразделению, продукту, заказу, каналу, кампании или причине |
| Продажи | Воронка, конверсия, средний чек, новые/активные клиенты, повторные покупки, каналы и сегменты |
| Заказы | Реестр, карточка, модерация, производство, доставка, поддержка и история событий |
| Производство | План/факт, очередь, lead time, загрузка, простои, брак и перепечатки |
| Финансы и люди | БДР/БДДС план-факт, затраты, маржа, штат, вакансии и отсутствия |
| Управленческий цикл | Отклонение → решение → задачи → фактический результат → проверка |
| Прогноз | Четыре будущие недели, нормо-часы, дефицит, резерв и первая дефицитная неделя |
| Качество данных | Свежесть, пропуски, дубли, ошибки, открытые проверки и финансовая сверка |
| Аудит | Пользователь, время, действие, объект, результат и изменения |
| Пользователи | Создание, редактирование и деактивация силами администратора |

Формулы и агрегаты рассчитывает Backend. Frontend форматирует данные и не подменяет
`no_data` нулём.

## Роли

| Роль | Основной доступ |
| --- | --- |
| Администратор | Все разделы, пользователи, импорт и пересчёт KPI |
| Директор | Бизнес-данные, решения, задачи и чтение аудита |
| Руководитель | Только своё подразделение; решения, задачи, финансы и HR-агрегаты |
| Аналитик | Чтение бизнес-данных и запуск проверок качества без изменения workflow |
| Сотрудник | Свои задачи и связанные решения/заказы; изменение только статуса задачи |

Для демонстрации используются аккаунты:

| Роль | Backend seed |
| --- | --- |
| Администратор | `admin@fotoprint.demo` |
| Директор | `director@fotoprint.demo` |
| Руководитель | `manager@fotoprint.demo` |
| Аналитик | `analyst@fotoprint.demo` |
| Сотрудник | `employee@fotoprint.demo` |

На странице входа выбор демо-роли подставляет соответствующие email и пароль.
Пароли Backend задаются при seed через `DEMO_*_PASSWORD`. Текущие публичные значения
синтетических демоаккаунтов продублированы в `src/lib/auth/demo-accounts.ts` для
автоподстановки; при смене пароля на Backend этот набор нужно обновить и пересобрать
frontend. Frontend-моки используют собственный демонстрационный набор.

Права в интерфейсе нужны для скрытия недоступных действий. Решение о доступе
принимает Backend.

## Безопасность сессии

- Access JWT хранится только в памяти и не записывается в `localStorage`.
- Refresh JWT передаётся Backend в HttpOnly-cookie; frontend его не читает.
- Параллельные ответы `401` используют одну refresh-очередь и один повтор запроса.
- `403` не разлогинивает пользователя и показывает состояние недостаточных прав.
- Создание решения и задачи отправляет `Idempotency-Key`; изменение использует
  текущую `version`.

## Доступ к API

При раздельном HTTPS-размещении Vercel и Render Backend должен разрешать точный
origin frontend. В Backend задаются:

```env
APP_ENV=production
FRONTEND_URL=https://photoprint-frontend.vercel.app
BACKEND_URL=https://backend-v8pa.onrender.com
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

Wildcard в `FRONTEND_URL` не заменяет точный origin для cookie-запросов.

## Деплой на Vercel

В проекте Vercel укажите:

- repository root: каталог с `package.json`;
- build command: `npm run build`;
- output directory: `dist`;
- install command: `npm ci`;
- `VITE_API_URL=https://backend-v8pa.onrender.com/api/v1`;
- `VITE_USE_MOCKS=false`.

`vercel.json` уже содержит SPA-fallback, команды сборки, security-заголовки и
долгий cache для `/assets/*`. Проверьте production URL после каждого деплоя.

## Проверка

На 2026-11-12:

- `npm run test:api` — 18/18 тестов;
- `npm run build` — успешная production-сборка;
- опубликованный Backend `/health` — HTTP 200, PostgreSQL подключён;
- опубликованный frontend доступен.

Эти проверки не заменяют полный браузерный E2E-прогон. Автоматизированный
визуальный и role-based browser-сценарий в репозиторий пока не включён.

## Структура

```text
src/
  app/            router, providers, auth guards
  components/     layout, forms, tables, filters, shared UI
  constants/      labels, KPI descriptions
  features/       screens by product area
  lib/api/        HTTP client, endpoints, pagination and adapters
  lib/auth/       session state, token store and UI capability matrix
  lib/mock/       in-memory API used only in mock mode
  types/          API 1.2 wire types
tests/            Node HTTP/adapter/layout regression tests
```

## Лицензии

Прямые зависимости и их лицензии перечислены в
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). Полный граф транзитивных
пакетов и версии зафиксированы в `package-lock.json`.

Карта интеграции с Backend и история технических решений находятся в
[BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) и [AGENT_LOG.md](AGENT_LOG.md).
