# AGENT_LOG — журнал работ по frontend MVP «Единая система управления компанией» (ООО «Фотопринт»)

Документ для других агентов и разработчиков: что уже сделано, какие решения приняты,
какие конвенции соблюдать и что осталось.

Дата последней записи: **2026-11-12**. Стек: React 18 + TS + Vite + Tailwind + React Router +
Axios + TanStack Query v5 + RHF + Zod + Sonner + Lucide. Контракт: **API 1.2**.

---

## 1. Состояние проекта

| Блок | Статус | Примечание |
| --- | --- | --- |
| Каркас (Vite/TS/Tailwind/Router/Axios/Query/RHF/Zod/Sonner/Lucide) | готово | `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `vercel.json` |
| Типы контракта 1.2 | готово | `src/types/api.ts` — все DTO, перечисления, конверты |
| HTTP-клиент | готово | `src/lib/api/client.ts` — mock/real переключение, refresh-очередь, `ApiError`, `createIdempotencyKey` |
| Слой вызовов API | готово | `src/lib/api/endpoints.ts` — 17 групп endpoint-ов |
| RBAC | готово | `src/lib/auth/rbac.ts` — Capability-матрица + `navVisibility` + `homeRoute` |
| Auth | готово | `src/lib/auth/auth-context.tsx` (bootstrap через refresh + `/auth/me`), `token-store.ts` (только память) |
| Mock-слой | готово | `src/lib/mock/` — seed (520 заказов, 210 клиентов, 320 тикетов, 130 производственных записей, 210 CRM-сделок, 12×3 HR-снимков, планы, 4 алерта, 5 решений, 8 задач, 140 audit-записей) + handlers + router |
| UI-кит и layout | готово | `components/ui`, `components/tables`, `components/filters`, `components/layout`, `components/feedback` |
| Экраны | **готово (23 файла)** | см. раздел 3 |
| Документация | готово | `README.md`, `BACKEND_INTEGRATION.md`, `.env.example`, этот файл |
| Сборка | `tsc --noEmit` — **0 ошибок**; `vite build` — проверять после финальной сверки | |

## 2. Ключевые решения (не менять без причины)

1. **Единая точка выбора транспорта.** `USE_MOCKS` вычисляется в `client.ts`; при пустом
   `VITE_API_URL` включаются моки. Экраны не знают о существовании моков — они вызывают
   только `endpoints.ts`. Поэтому подключение реального API не требует правок UI.
2. **Access Token только в памяти** (`token-store.ts`), refresh — httpOnly-cookie от сервера.
   `withCredentials: true` на axios-инстансе. Никаких токенов в `localStorage`.
3. **Refresh-очередь.** На 401 (кроме `/auth/*`) поднимается один общий `refreshPromise`;
   остальные запросы ждут его и повторяются ровно один раз (`_retried`). При неудаче —
   `tokenStore.clear()` + обработчик `setUnauthorizedHandler` → сброс React Query и редирект.
4. **403 не разлогинивает.** Только показывает `ForbiddenState`; сессия сохраняется.
5. **`toApiError`** приводит любой сбой к `ApiError{status, code, fields, requestId}`.
   Все экраны берут текст и поля ошибок из него (в т.ч. 422 → `setError` в RHF).
6. **Конфликт версий (409 `VERSION_CONFLICT`).** В карточках решения и задачи: сообщение
   остаётся на экране, форма **не** затирается, выполняется `query.refetch()` — пользователь
   повторяет сохранение с новой версией. Так выполняется требование «сохранить ввод пользователя».
7. **Идемпотентность создания.** `createIdempotencyKey()` (UUID v4) генерируется один раз на
   открытии формы и передаётся в заголовке `Idempotency-Key`; при повторной отправке
   ключ тот же. Новый ключ — только после успешного создания.
8. **Фильтры в URL.** `FiltersContext` пишет `date_from/date_to/preset/department_id/product_id`
   в query-string (`replace: true`) — состояние переживает перезагрузку и копируется как ссылка.
   Провайдер подключается только для маршрутов из `FILTER_ROUTES` (`AppLayout.tsx`).
9. **Игнорируемые фильтры.** Если показатель не поддерживает срез, Backend отдаёт
   `context.ignored_filters`, а UI показывает бейдж «фильтр не применён» (HR по продукту,
   БДР/БДДС по продукту).
10. **Отсутствие данных ≠ ноль.** `actual = null` → статус `no_data` + `reason_code`;
    прогноз при `status="no_data"` показывает причину и не рисует нулевые столбцы.
11. **BI-embed.** Только подписанная ссылка из `/analytics/metabase-embed`. При ошибке/503 —
    сообщение + «Повторить»; публичный fallback запрещён. В моках URL служебный
    (`about:blank#metabase-demo`), поэтому вместо iframe рендерится заглушка-график
    (`MockBiPreview` в `AnalyticsPage.tsx`) — это дем-режим, а не fallback.
12. **Расчёты не на клиенте.** Формулы, KPI, план/факт, воронка, прогноз, сверка —
    всё берётся из API. На фронте только форматирование (`lib/formatters`).
13. **Графики — own SVG.** Внешних чарт-библиотек нет (в `package.json` их не добавлять без
    необходимости): история KPI рисуется через `<svg>` в `MetricDetailPage.tsx`, воронка и
    бары прогноза — через div-полосы.
14. **Тёмная тема.** Палитра `ink-*` (почти чёрный `#07090d`) + акцент `accent-*`
    (`#2cc5b0`) + сигнальные `signal.ok/warn/bad/idle/info/violet`. Глобальные классы:
    `.surface`, `.table-shell`, `.label-caps`, `.link-quiet` (`styles/index.css`).

## 3. Экраны (все на диске, `src/features/`)

| Маршрут | Файл | Право |
| --- | --- | --- |
| `/login` | `auth/LoginPage.tsx` | — |
| `/` → home | `app/HomeRedirect.tsx` | employee → `/tasks` |
| `/dashboard` | `dashboard/DashboardPage.tsx` | `analytics.view` |
| `/sales` | `sales/SalesPage.tsx` | `sales.view` |
| `/orders`, `/orders/:id` | `orders/OrdersPage.tsx`, `orders/OrderDetailPage.tsx` | `orders.read` |
| `/production` | `production/ProductionPage.tsx` | `production.view` |
| `/finance-hr` | `finance-hr/FinanceHrPage.tsx` | `finance.view` |
| `/analytics` | `analytics/AnalyticsPage.tsx` | `bi.view` |
| `/alerts`, `/alerts/:id` | `alerts/AlertsPage.tsx`, `alerts/AlertDetailPage.tsx` | `analytics.view` |
| `/decisions`, `/decisions/new`, `/decisions/:id` | `decisions/*.tsx` | `decisions.read` / `.write` |
| `/tasks`, `/tasks/:id` | `tasks/TasksPage.tsx`, `tasks/TaskDetailPage.tsx` | `tasks.read` |
| `/forecast` | `forecast/ForecastPage.tsx` | `forecast.view` |
| `/data-quality` | `data-quality/DataQualityPage.tsx` | `dataQuality.view` |
| `/audit-logs` | `audit-logs/AuditLogsPage.tsx` | `audit.read` |
| `/users` | `users/UsersPage.tsx` | `users.manage` |
| `/metrics/:code` | `metrics/MetricDetailPage.tsx` | `analytics.view` |
| `/customers/:id` | `customers/CustomerDetailPage.tsx` | `sales.view` |
| `/403`, `*` | `errors/ForbiddenPage.tsx`, `errors/NotFoundPage.tsx` | — |

## 4. Конвенции для новых файлов

- Импорты внутри проекта — через алиас `@/…` (не относительные `../../`).
- Компоненты экрана: `export function XxxPage()` (именованный экспорт, default не используется).
- Данные — `useQuery` с `queryKey` из идентификаторов фильтрации, `queryFn` — тонкая обёртка
  над `xxxApi`. Для списков с пагинацией: `placeholderData: (previous) => previous`.
- Мутации — `useMutation` + `toast.success/error` (Sonner) + `invalidateQueries` по
  затронутым ключам (карточка, реестр, `dashboard`).
- Формы — RHF + `zodResolver`. Серверные 422 маппятся в поля:
  `Object.entries(apiError.fields).forEach(([f, m]) => setError(f, { type: 'server', message: m }))`.
- Права в UI — только через `useAuth().can(capability)`; никаких проверок роли «на месте».
- Подписи статусов/приоритетов/ролей/каналов — исключительно из `constants/labels.ts`
  (`*_LABELS`, `*_TONES`). Новые строки добавлять туда, а не инлайном.
- Форматирование — только из `lib/formatters` (`formatMoney`, `formatPercent`, `formatUnit`,
  `formatHours`, `formatDate(Time)`, `formatDaysLeft`, `initials`).
- Таблицы: если нужна сортировка/пагинация/клики — `DataTable` + `Pagination`;
  простые таблицы можно размечать через `table.table-shell` (как в существующих экранах).
- TS strict: `noUnusedLocals`/`noUnusedParameters` включены — неиспользуемые импорты
  **ломают сборку**, чистить сразу.
- Команда проверки после правок: `npx tsc --noEmit` (быстрая) и `npm run build` (полная).

## 5. Известные ограничения и что осталось

1. **Экспорт реестров** — кнопка в `/orders` намеренно `disabled` (endpoint не определён в 1.2).
2. **Участки производства** — справочника нет, роль участка выполняет подразделение.
3. **Реалтайм** — WebSocket/SSE не подключены; обновление по кнопке в шапке
   (`queryClient.invalidateQueries()`), смене фильтров или `staleTime` 30 с.
4. **Смена пароля / восстановление доступа** — вне MVP (учётные записи создаёт администратор).
5. **Тесты** — unit/E2E-обвязки нет. Для хакатонного MVP проверяется типами и ручным прогоном;
   при появлении тестов — `vitest` + `@testing-library/react`, не менять скрипты `build`.
6. **Линтер** — ESLint-конфиг в проект не добавлен (в `package.json` нет `lint`). Если нужен —
   добавлять `eslint` + `eslint-config` отдельным шагом и не конфликтовать с `tsc`.
7. Мок-данные детерминированы (mulberry32 + seed по UUID), но живут в памяти вкладки:
   изменения (созданные решения/задачи, смена статусов) исчезают после перезагрузки —
   это ожидаемо для демо.

## 6. Как ревьюить себя перед коммитом

```bash
cd /path/to/photoprint-frontend/frontend
npx tsc --noEmit      # 0 ошибок
npm run build         # dist/ собирается
npm run dev           # ручной прогон сценария из README
```

Сценарий проверки: вход директором → дашборд (12 KPI) → карточка KPI (история + детализация) →
отклонение → решение (создание → в работу → на проверку → выполнено) → задача (старт → завершение) →
прогноз → качество данных (проверка + импорт) → журнал действий → пользователи → вход сотрудником
(только `/tasks`) → аналитик (изменение запрещено).


## 7. Аудит по ТЗ 1.2 (12.11.2026)

- Визуальная система обновлена: графитовый фон, кобальтовый акцент, менее шумные поверхности и без ложной метки времени последнего обновления.
- Менеджеру закреплено собственное подразделение в фильтре и форме создания задачи; защита данных остаётся обязанностью Backend.
- Сотрудники доступны в списке исполнителей задач.
- Управление пользователями включает редактирование ФИО, роли и подразделения; поле временного пароля скрыто.
- .env.example включает автоматические моки только при пустом VITE_API_URL, чтобы заполненный адрес Backend не перекрывался включённым флагом.
- Vercel-конфигурация использует `npm ci` и SPA fallback.
- `npm run build` проходит; Vite предупреждает, что общий JS chunk превышает 500 kB (minified).

## 8. Дополнительный аудит и исправления (12.11.2026)

- Директорские `/data-quality` и `/decisions` вызывали `useFilters()` вне `FiltersProvider`; оба маршрута добавлены в набор страниц, где включён общий фильтр.
- Фильтры периода, подразделения и продукта сохраняются при переходах между отчётными разделами, включая ссылки с дополнительными параметрами (`status`, `alert_id`).
- Убраны технический бейдж с ключом идемпотентности и декоративные `Sparkles`-иконки, фоновые свечения и размытие шапки; оставлена сдержанная графитово-кобальтовая тема.
- Исправлено ложное время обновления внизу реестра заказов; теперь отображается только полезная подсказка о статусах.
- В браузере вручную открыты директорские страницы качества данных, решений и форма нового решения. `npm run build` завершился успешно; остаётся только предупреждение Vite о размере JS chunk.
- Metabase уже предусмотрен интеграционным контрактом: UI запрашивает подписанный URL через `/analytics/metabase-embed` и безопасно показывает состояние недоступности; мок даёт демо-превью. Реальная BI-интеграция требует backend URL signer и фильтрации по полномочиям. Дополнительный самописный набор BI-графиков не нужен: он дублирует Metabase, а текущие KPI и графики прогноза закрывают обзорные сценарии.

## 9. Глобальный масштаб интерфейса (12.11.2026)

- Базовый размер шрифта задан в `src/styles/index.css`: `html { font-size: 18px }` (браузерная норма — 16px). Это единая ручка масштаба всего UI.
- Чтобы масштаб действительно был единым, все произвольные размеры текста в `px` переведены в `rem`: `text-[9px]→text-[0.5625rem]`, `text-[10px]→text-[0.625rem]`, `text-[11px]→text-[0.6875rem]`, `text-[13px]→text-[0.8125rem]` (191 место), а `-left-[21px]` у маркеров таймлайна — в `-left-[1.3125rem]`. Стандартные классы Tailwind (`text-xs`, `p-3`, `gap-3`, `h-14`) изначально в `rem` и растут автоматически.
- **Не трогать:** перевод обратно в `px` вернёт рассинхрон — часть интерфейса будет масштабироваться, часть нет. Новые размеры текста писать в `rem` или стандартными классами.
- Ширина контента: `max-w-[1680px]` по центру в `AppLayout` (иначе на 2K-мониторах строки растягиваются нечитаемо), сайдбар `w-64` вместо `264px`.
- Сетка KPI на дашборде: `sm:grid-cols-2 xl:grid-cols-3 min-[2100px]:grid-cols-4`. На 4 колонки карточки не влезали при 18px базе — название и значение обрезались. Название KPI теперь `line-clamp-2` вместо `truncate`, значение вынесено из сжатой колонки, чтобы не резалось.
- `npm run build` и `npx tsc --noEmit` после изменений — успешно.


## 10. Подвязка текущего Backend — 2026-11-12 (не завершена)

Пользователь разрешил только подключение эндпоинтов, запретив изменения UI/UX.
Существующий комментарий `// backend wiring` в endpoints.ts сохранён.
Изменены только API-клиент, endpoint-обёртки, адаптер карты, helper пагинации,
тип AI-ответа, тестовая команда и документация. Компоненты и стили не изменены.

Исправлены справочники/история KPI, карта/AI и auth retry. Подробности и
неподключённые части — в начале BACKEND_INTEGRATION.md. `npm run test:api`:
10 passed; `npm run build`: успешно, предупреждение о размере chunk.
Серверные изменения, миграции, seed, удалённые запросы, коммит, push и
Computer Use не выполнялись. Реальное окружение не переключено.

Активных записей в файлы нет; работа ожидает ответы пользователя про целевые
URL, дедлайны, импорт, Metabase и допустимость дополнений Backend.


## 11. Подвязка API и серверные mock-источники — 2026-11-12

Пользователь подтвердил Render API и Vercel origin; разрешил заменить Metabase
графиками, исключил frontend-импорт, задал deadline до конца дня Минска,
разрешил дополнить Backend имеющимися данными и добавить комментарий закрытия Alert.
Прежний запрет UI/UX сохранён для остальных разделов; исправлены только привязки прав.

Выполнены адаптеры Customer/Task/Decision/Dashboard/Production/Impact,
справочники и пагинация, фильтры, auth retry, дата/время, employee status-only,
role-aware запросы и обновление качества после check. Metabase удалён из UI/API/mock.
Аналитика использует API history/sales/production, содержит доступную таблицу динамики,
сохраняет нули и разрывы null. Проверен react-best-practices checklist: хуки верхнего
уровня, полные query keys, enabled для зависимых запросов, отдельные состояния ошибок,
без новых UI-библиотек, стили существующей темы. Браузерная проверка не проводилась.

15 frontend тестов прошли; build/TypeScript успешно, предупреждение о размере chunk.
Backend: 131 passed на временной PostgreSQL. Серверные mock-источники — отдельный
admin-only read API, обычные экраны их не используют. Детали в BACKEND_INTEGRATION.md.

Live Render: /openapi.json HTTP 200, дополнения ещё не выложены; CORS для Vercel
origin возвращал 400 Disallowed CORS origin. Нужно выставить FRONTEND_URL и cookie
настройки и выложить обе части. Нет коммита/push/deploy, изменений удалённой БД,
секретов или Computer Use. Все прежние изменения сохранены.


Последующая live-проверка: пользователь изменил FRONTEND_URL в Render Environment,
дождался деплоя. Preflight для Vercel origin теперь HTTP 200 с точным Allow-Origin
и allow-credentials:true, для localhost — 400. Ошибка CORS из записи выше устранена
настройкой окружения; выкладка наших локальных изменений кода ещё не выполнена.


## 12. Демонстрационные аккаунты с Backend — 2026-11-12

По прямому запросу пользователя блок аккаунтов LoginPage теперь виден и с API.
Кнопки выбирают @fotoprint.demo для Backend, @photoprint.by для frontend-моков.
Для API пароль вводится в обычную форму, приватные seed-пароли не публикуются.
Пользователь подтвердил использование того же /auth/login без отдельного endpoint.
Layout/стили блока сохранены. npm run build успешен, прежнее предупреждение chunk.


Checkpoint follow-up: configured DB was empty; at explicit user request the exact
seed dataset was batch-loaded and committed. Verified 500 orders, 200 customers,
500 CRM deals, 300 support records and all five active seed logins/password hashes.
Live Render director /auth/login, /orders (total=500), /auth/refresh and /auth/logout
all returned 200. No bypass endpoint was added. Chooser source change remains local;
frontend publication is still needed. Private passwords were never bundled or printed.


## 13. Пароли в кнопках демоаккаунтов — 2026-11-12

Пользователь явно разрешил сделать текущие пять DEMO_* паролей публичными и
после первоначального автоматического отказа включил full access для продолжения.
Дополнительная read-only проверка: всего 6 аккаунтов БД, все синтетические
@fotoprint.demo; пять выбранных паролей соответствуют активным аккаунтам.

Добавлен src/lib/auth/demo-accounts.ts с разрешёнными публичными демоданными.
LoginPage подставляет email/password выбранной роли и валидирует оба поля;
обычная отправка по /auth/login сохранена. Frontend-моки используют прежний пароль.
Другие секреты не переносились, значения не печатались в вывод или документацию.
Права/БД не менялись. Сборка и TypeScript прошли; прежнее предупреждение chunk.
Существующие staged изменения сохранены; новые изменения не коммитились/публиковались.


## 14. Исправление пустой карты при реальном API — 2026-11-12, только локально

API отдаёт узлы без position; Canvas пропускал все узлы и связи без координат.
Вынесены прежние раскладки из mock/impact-map.ts в features/impact-map/layout.ts:
обзор по типам и фокус вокруг выбранного узла. API adapter применяет обзор,
а neighbors — фокус с выбранным node ID/depth. Моки используют тот же модуль.
Тела обоих алгоритмов сравнены с HEAD и сохранены точно; Canvas/стили не менялись.

Три новых регрессионных теста настоящего SVG Canvas (Node static render) сначала
падали: 0 отрисованных узлов вместо 2. После исправления overview/neighbors/path
рисуют узлы/связи, выбранный KPI находится в (800,460). Всего 18 тестов прошли;
TypeScript и build успешны, прежнее предупреждение chunk. Diff whitespace чист.
Браузер/Computer Use не использовались, визуальная проверка не проводилась.
По прямому запрету пользователя нет commit/push/staging; изменения только локальные.


## 15. Сверка с ТЗ и инструкция запуска — 2026-11-12

Проверены оба PDF ТЗ, frontend-маршруты, RBAC, API-контракт, live health и
регрессионные наборы. Для трека 1 обязательные экраны и сценарии представлены;
frontend автоматически не покрывает визуальный browser E2E.

README заменён на проверяемую инструкцию с тремя режимами запуска и корректным
путём к `photoprint-frontend/frontend`. Убраны неверный Windows-путь и устаревший
счётчик тестов. Добавлен THIRD_PARTY_LICENSES.md; в истории KPI подписана
группировка по кампаниям, исправлена подпись временного пароля пользователя.

Проверки: `npm run test:api` — 18/18; `npm run build` — успешно; локальный Vite
`http://127.0.0.1:5173/` — HTTP 200; live Backend `/health` — HTTP 200.
Чистый `git diff --check`. Commit/push/deploy и Computer Use не выполнялись.
