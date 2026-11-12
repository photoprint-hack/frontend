# Переключение frontend на реальный Backend

Документ для тех, кто разворачивает или дорабатывает Backend. Описано, что нужно сделать,
чтобы интерфейс начал работать с настоящим API **без изменения экранов**.

## 1. Что переключается

Фронт выбирает транспорт в одном месте — `src/lib/api/client.ts`:

```ts
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const mockFlag = String(import.meta.env.VITE_USE_MOCKS ?? '').toLowerCase();
export const USE_MOCKS = mockFlag === 'true' || mockFlag === '1' || API_BASE_URL === '';
```

`http.get/post/patch/delete` при `USE_MOCKS === true` идут в `lib/mock/router.ts`,
иначе — через axios в `API_BASE_URL`. Экраны вызывают только функции из
`src/lib/api/endpoints.ts`, поэтому переключение не затрагивает UI.

### Шаги

1. Задайте переменные окружения (`.env.local` для разработки, Project Settings → Environment
   Variables для Vercel):

   ```
   VITE_API_URL=https://api.example.com/api/v1
   VITE_USE_MOCKS=false
   VITE_MOCK_LATENCY=0
   ```

   `VITE_API_URL` должен включать префикс версии (`/api/v1`) — фронт сам его не добавляет.
2. Настройте на Backend CORS для origin фронтенда: `Access-Control-Allow-Origin` (точный origin,
   не `*`), `Access-Control-Allow-Credentials: true`, разрешите заголовки
   `Authorization`, `Content-Type`, `Idempotency-Key` и методы `GET, POST, PATCH, DELETE`.
3. Реализуйте cookie-пары refresh: `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`
   (путь должен покрывать `/auth/refresh`). Access Token во фронт возвращается в теле ответа
   и хранится только в памяти.
4. Уберите/задеплойте mock-код не нужно: он остаётся в бандле, но не используется, если
   `VITE_API_URL` задан и `VITE_USE_MOCKS=false`. При необходимости полностью вырезать —
   удалите `src/lib/mock/` и ветку `USE_MOCKS` в `client.ts`.

## 2. Формат ответов (контракт 1.2)

- Все поля — `snake_case`; даты — ISO-8601 UTC (`2026-11-12T08:30:00Z`).
- Один объект: `{ "data": { ... } }`.
- Список: `{ "items": [...], "total": 123, "page": 1, "page_size": 20, "pages": 7 }`.
- Ошибка: `{ "detail": { "code": "...", "message": "...", "fields": { "title": "..." }, "request_id": "..." } }`
  (фронт читает именно `detail`; `ApiError` см. `lib/api/client.ts:toApiError`).
- Пагинация: `page` (с 1), `page_size` (1…100). Фронт запрашивает `page_size` 10–120.
- Сортировка: `sort_by`, `sort_order=asc|desc`.
- Поиск: `search` — подстрока по полям, перечисленным в таблице ниже.

### Общие query-параметры фильтров

`date_from`, `date_to` (`YYYY-MM-DD`), `department_id`, `product_id`.
Если фильтр неприменим к показателю, Backend возвращает его в `context.ignored_filters`,
а UI показывает бейдж «фильтр не применён».

## 3. Эндпоинты, которые вызывает фронт

Точный список — `src/lib/api/endpoints.ts`. Ниже — что нужно Backend-у по каждому.

### Auth

| Метод | Путь | Тело / ответ |
| --- | --- | --- |
| POST | `/auth/login` | `{email, password}` → `{data:{access_token, token_type:"bearer", expires_in, user}}` + `Set-Cookie` refresh |
| POST | `/auth/refresh` | пусто → `{data:{access_token, token_type, expires_in}}`, обновляет cookie |
| GET | `/auth/me` | → `{data: AuthUser}` |
| POST | `/auth/logout` | → `{data:{success:true}}`, очищает cookie |

`AuthUser`: `id, email, full_name, role, department_id, is_active`.
`role ∈ admin|director|manager|analyst|employee`.

### Дашборд и показатели

| Метод | Путь | Ответ |
| --- | --- | --- |
| GET | `/dashboard?date_from&date_to&department_id&product_id` | `{data: DashboardResponse}` — 12 KPI + `recent_alerts/decisions/tasks` + счётчики |
| GET | `/metrics?...` | пагинированный список `Kpi` |
| GET | `/metrics/{code}?...` | `{data: Kpi}` |
| GET | `/metrics/{code}/history?...&interval=day|week|month` | `MetricHistoryResponse` (точки `period_start/period_end/actual/target/status`) |
| GET | `/metrics/{code}/breakdown?...&group_by=department|product|order|channel|cause` | `MetricBreakdownResponse` |
| POST | `/metrics/recalculate?...` | `{data:{calculated_at, metric_values_updated, alerts_created, alerts_updated}}` (admin) |

`Kpi` обязан содержать: `code, name, unit, direction, actual, target, forecast,
achievement_percent, deviation_percent, status, source[], formula, formula_version,
forecast_method, reason_code, reason, source_updated_at, updated_at, context, notices[],
supported_group_by[]`.

- `status ∈ normal|warning|critical|no_data`. Пороги: отклонение ≤5% — норма, ≤10% —
  предупреждение, >10% — критично; для `capacity_utilization` (`direction="range"`)
  коридор 70–110%.
- При `actual = null` обязателен `status="no_data"` и заполненный `reason_code`
  (например `TARGET_MISSING`, `SOURCE_STALE`). UI не подменяет отсутствующие значения нулями.
- `supported_group_by` управляет доступными разрезами детализации; пустой массив = «детализация
  не предусмотрена».

### Реестры и карточки

| Метод | Путь | Особенности |
| --- | --- | --- |
| GET | `/orders` | фильтры: период, `status`, `search` (номер/клиент), сортировка `created_at/amount/due_at/completed_at` |
| GET | `/orders/{id}` | `Order` с `version` и `allowed_actions[]` |
| GET | `/orders/{id}/events` | `OrderEvent[]` — история сквозного процесса |
| PATCH | `/orders/{id}` | `{version, ...полей}`; при несовпадении версии — **409 `VERSION_CONFLICT`** |
| GET | `/customers` | `search` (имя/внешний ID), `segment` |
| GET | `/customers/{id}` | `{data: Customer & {orders: Order[]}}` |
| GET | `/products`, `/departments` | `{data: Product[]}` / `{data: Department[]}` — справочники для фильтров |
| GET | `/sales/summary`, `/sales/funnel`, `/sales/deals` | воронка по сопоставимой когортам, каналы/сегменты |
| GET | `/production/summary`, `/production/records`, `/production/queue` | очередь = заказы в `queued|in_progress` |
| GET | `/finance/summary` | БДР + БДДС в формате `{plan, fact, deviation, achievement_percent}` |
| GET | `/hr/summary` | последний снимок по подразделениям + `snapshot_dates[]` |
| GET | `/forecast` | `ForecastResponse`, `method="four_week_average"`, `unit="standard_hour"`, 4 недели, `status: ready|no_data` + `reason` |

### Управленческий цикл

| Метод | Путь | Правила |
| --- | --- | --- |
| GET | `/alerts?status&metric_code&search` | `Alert` с `opening_actual/opening_target` (значения на момент открытия) |
| GET | `/alerts/{id}` | `AlertDetail`: `alert, metric, decisions[], tasks[], causes[], related_orders[], breakdown_url` |
| PATCH | `/alerts/{id}` | `{status}` ∈ `active|acknowledged|resolved`; employee/analyst — **403** |
| GET | `/alerts/{id}/history` | `ChangeEvent[]` |
| GET | `/decisions?status&priority&owner_id&overdue&search` | `Decision` |
| POST | `/decisions` | заголовок **`Idempotency-Key`** (UUID) обязателен; 422 с `fields` при ошибках; admin/director/manager |
| GET | `/decisions/{id}`, `/decisions/{id}/history` | история недоступна employee |
| PATCH | `/decisions/{id}` | `{version, ..., status?, actual_result?, verification_note?, comment?}`; переходы `new→in_progress→needs_review→completed`, `→cancelled`; для `needs_review` обязателен `actual_result`, для `completed` — `verification_note`, для `cancelled` — `comment` |
| GET | `/tasks?status&priority&assignee_id&decision_id&mine&overdue&search` | employee видит только свои задачи |
| POST | `/tasks` | `Idempotency-Key`, admin/director/manager |
| GET | `/tasks/{id}`, `/tasks/{id}/history` | история — только исполнитель/руководящие роли |
| PATCH | `/tasks/{id}` | `{version, status?, ...}`; `cancelled` требует `comment` и руководящей роли |
| DELETE | `/tasks/{id}` | архивация, только admin |

### Данные, аудит, пользователи, BI

| Метод | Путь | Примечание |
| --- | --- | --- |
| GET | `/data-quality/sources` | `DataSource[]` (status, is_stale, счётчики импорта) |
| GET | `/data-quality/overview` | агрегат + `reconciliation` |
| GET | `/data-quality/issues?source` | `DataQualityIssue[]` |
| GET | `/data-quality/reconciliation` | сверка ERP ↔ Finance, `difference_percent`, `status` |
| POST | `/data-quality/check` | admin/analyst |
| POST | `/integrations/{crm|erp|finance|support|hr}/import` | только admin |
| GET | `/audit-logs?action&object_type&status&user_id&search` | только admin/director, иначе 403 |
| GET | `/audit-logs/{id}` | `AuditLog` с `old_values/new_values/details/request_id` |
| GET | `/users?search&role&is_active&department_id` | admin → полный `User`; director/manager/analyst → урезанный `{id, full_name, role, department_id}`; employee → 403 |
| POST | `/users`, PATCH `/users/{id}` | только admin; `temporary_password` ≥ 12 символов; 409 при деактивации последнего admin |
| GET | `/analytics/metabase-embed?...` | `{data:{embed_url, expires_at}}` — подписанный URL. При недоступности BI возвращайте **503** с `code="BI_SERVICE_UNAVAILABLE"`: UI покажет сообщение и кнопку «Повторить», публичную ссылку не подставляет |
| GET | `/health` | `{data:{status, database, version}}` |

## 4. Согласованность статусов и кодов

Значения перечислений должны совпадать с `src/types/api.ts` буквально (регистр, `_`):

```
roles:        admin | director | manager | analyst | employee
metric status:normal | warning | critical | no_data
decision:     new | in_progress | needs_review | completed | cancelled
task:         new | in_progress | completed | cancelled
alert:        active | acknowledged | resolved
order:        new | in_progress | completed | cancelled
moderation:   pending | approved | rejected | revision_required
production:   queued | in_progress | completed | blocked
delivery:     not_started | in_transit | delivered | delayed | returned
priority:     low | medium | high | critical
severity:     low | medium | high | critical (issues) / critical (alerts)
source code:  crm | erp | finance | support | hr
source status:healthy | warning | error | not_loaded
```

Коды `metric.code` (12 штук): `revenue, gross_margin, on_time_orders, defect_rate,
new_customers, active_customers, repeat_purchase_rate, support_sla, capacity_utilization,
staffing_coverage, sales_plan_achievement, critical_alerts_count`.

Коды ошибок, на которые реагирует UI: `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`,
`AUTH_FORBIDDEN`, `DEPARTMENT_ACCESS_DENIED`, `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`
(+ `fields`), `VERSION_CONFLICT`, `INVALID_STATUS_TRANSITION`, `DUPLICATE_RESOURCE`,
`BI_SERVICE_UNAVAILABLE`, `NETWORK_ERROR`.

`allowed_actions[]` в карточках (`read`, `update`, `start`, `submit_review`, `verify`,
`cancel`, `acknowledge`, `resolve`, `archive`) фронт использует для показа кнопок;
полный список — в контракте.

## 5. Как проверить интеграцию

1. `npm run dev` с моками — интерфейс должен выглядеть так же, как после подключения API.
2. Задайте `VITE_API_URL`, `VITE_USE_MOCKS=false`, `VITE_MOCK_LATENCY=0`.
3. Пройдите сценарий: вход → дашборд (12 KPI) → карточка KPI (история + детализация) →
   отклонение → решение (создание, `in_progress`, `needs_review`, `completed`) → задача
   (`start`, `completed`) → прогноз → качество данных → журнал действий.
4. Отдельно проверьте негативные кейсы: 401 → авто-refresh → повтор запроса; 403 → экран
   «недостаточно прав»; 409 `VERSION_CONFLICT` при параллельном редактировании решения;
   422 с `fields` в форме создания решения; `no_data` у прогноза и KPI.
5. В Vercel: `vercel env add VITE_API_URL production`, затем `vercel --prod`.

## 6. Известные упрощения MVP

- Экспорт реестров (кнопка «Экспорт» в `/orders`) помечен `disabled` — endpoint не определён.
- Участок производства моделируется подразделением: отдельного справочника участков в контракте 1.2 нет.
- Подписка на обновления (WebSocket/SSE) не реализована — данные обновляются по запросу,
  кнопкой в шапке или сменой фильтров (staleTime = 30 с).
- Прогноз KPI на дашборде считается Backend-ом (`forecast_method="calendar_day_run_rate"`
  для оборота); UI его не пересчитывает.
