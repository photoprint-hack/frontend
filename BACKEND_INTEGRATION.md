# Подключение Frontend к Photoprint API

API: https://backend-v8pa.onrender.com/api/v1.
Frontend: https://photoprint-frontend.vercel.app.

## Переменные окружения

Для Vercel задайте перед сборкой:

```env
VITE_API_URL=https://backend-v8pa.onrender.com/api/v1
VITE_USE_MOCKS=false
```

Без VITE_API_URL клиент использует указанный Render API. Явное пустое значение
или VITE_USE_MOCKS=true включает старые встроенные frontend-моки. Это отдельный
режим, не серверный mock API. .env.example содержит реальные публичные URL без секретов.
Для локального Backend используйте http://localhost:8000/api/v1.

В существующем Render Web Service:

```env
APP_ENV=production
FRONTEND_URL=https://photoprint-frontend.vercel.app
BACKEND_URL=https://backend-v8pa.onrender.com
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

Origin должен быть точным. Wildcard не подходит для запросов с refresh-cookie.
Блок «Демонстрационные аккаунты» доступен в обоих режимах. При Backend кнопки
подставляют seed-логины @fotoprint.demo и соответствующие демонстрационные пароли.
При frontend-моках подставляются @photoprint.by и публичный пароль моков.
Оба режима используют стандартный вызов authApi.login; отдельного демовхода нет.
Владелец явно разрешил публикацию пяти текущих DEMO_* паролей для автоподстановки.
Они находятся в src/lib/auth/demo-accounts.ts как публичные демоучётные данные.
Другие секреты Backend не публикуются. После изменения пароля демоаккаунта
нужно обновить этот набор и пересобрать frontend.

Авторизация: POST /auth/login, access JWT только в памяти, HttpOnly refresh-cookie;
все запросы используют credentials. При параллельных 401 выполняется общий
refresh и однократный повтор. /auth/me и /auth/logout также участвуют в повторе;
ошибка refresh или повторный 401 сбрасывает сессию. 403 сохраняет её.

После изменения переменных требуется новая сборка/деплой соответствующего сервиса.
Blueprint Backend не меняет окружение сервиса, созданного вручную.

## Адаптация существующих экранов

- Объекты читаются из data, списки из items. Все справочники загружаются постранично.
- Карточка Customer объединяет data.customer и все страницы /orders?customer_id=….
- Task/Decision используют вложенные department/decision; адаптер сохраняет формат
  текущих экранов. Название Alert отдаёт Backend в разрешённой области.
- Date-only deadline означает 23:59:59.999+03:00 выбранного дня (Europe/Minsk).
- Сотрудник отправляет только version/status своей Task. Поля редактирования
  и запросы пользователей/истории Decision учитывают серверные права.
- POST создания использует Idempotency-Key UUIDv4, PATCH — актуальную version.
- При закрытии active Alert запрашивается обязательный комментарий.
- Production использует actual_load_hours; planned_capacity — дневной план пары
  подразделение/продукт, nullable, без искусственного распределения по заказам.
- /production/queue и /forecast получают только поддержанные department/product
  и параметры пагинации/горизонта. Это текущая очередь и прогноз от текущей даты,
  а не историческая реконструкция по глобальному периоду.
- /data-quality/overview — глобальная сводка без фильтров; финансовая сверка
  получает период и область. После проверки источники перечитываются.

Карта использует data.node, код KPI из entity_ref.id, факты из metadata,
источник связи из evidence_source. edge_types сериализуется повторяющимися
query-параметрами. AI получает request_key UUIDv4 в JSON, graph_revision и только
четыре бизнес-фильтра в context. Ответ читается из data.analysis; timeout — 120 секунд.

## Графики и источники

Metabase удалён. Аналитика строит динамику выбранного KPI через /metrics/{code}/history,
оборот по каналам через /sales/summary, план/факт выпуска через /production/summary.
История: день для периода до 31 дня включительно, неделя до 180, месяц для более
длинного периода. Все страницы истории читаются запросами до 100 записей.
Нулевые значения сохраняются; null не превращается в 0 и разрывает линию.
Для графика динамики доступна таблица всех значений.

Кнопки и вызовы импорта исключены из frontend по решению пользователя.
Backend сохраняет API импорта и JSON/CSV CLI для отдельной работы.
GET /api/v1/mock-sources/{crm|erp|finance|support|hr}/records — отдельная
серверная имитация внешних источников, читающая БД. Только admin, без изменений.
Она не используется обычными экранами и не подключает настоящую CRM.

## Проверка и границы

```sh
npm run test:api
npm run build
```

На 2026-11-12: 15 frontend HTTP/geometry тестов прошли, TypeScript и production build
успешны. Backend: 131 тест прошёл на отдельной временной PostgreSQL.
Сборка сообщает о JS chunk больше 500 kB.

Live-схема Render прочитана (HTTP 200), но ещё не содержит новых дополнений.
После обновления пользователем FRONTEND_URL в Render preflight с origin
https://photoprint-frontend.vercel.app вернул HTTP 200, точный Allow-Origin и
Allow-Credentials=true; localhost:5173 теперь отклоняется (400). CORS исправлен.
Деплой новых изменений Backend/Frontend ещё требуется.
Позднее по запросу чекпоинта БД заполнена exact seed-набором: 500 заказов и
пять основных демоаккаунтов. Обычные live director login/orders/refresh/logout
проверены: HTTP 200. Браузерная проверка cookie и визуальная проверка не выполнялись.
Коммит, push и деплой этим этапом не выполнялись; удалённая БД заполнена демоданными только после отдельного явного разрешения пользователя.
