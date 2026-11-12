/** Статусы, приоритеты и подписи — единые коды контракта 1.2. */
import type {
  AlertStatus,
  DecisionStatus,
  DeliveryStatus,
  ModerationStatus,
  OrderStatus,
  Priority,
  ProductionStatus,
  Role,
  TaskStatus,
} from '@/types/api';

export type BadgeTone = 'ok' | 'warn' | 'bad' | 'idle' | 'info' | 'accent' | 'violet';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  director: 'Директор',
  manager: 'Руководитель подразделения',
  analyst: 'Аналитик',
  employee: 'Сотрудник',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Управление платформой, пользователями и импортом данных',
  director: 'Полный обзор компании, решения и проверка результатов',
  manager: 'Показатели, решения и задачи своего подразделения',
  analyst: 'Аналитика, качество данных и сверка',
  employee: 'Только свои задачи и связанные объекты',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

export const PRIORITY_TONES: Record<Priority, BadgeTone> = {
  low: 'idle',
  medium: 'info',
  high: 'warn',
  critical: 'bad',
};

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  new: 'Новое',
  in_progress: 'В работе',
  needs_review: 'На проверке',
  completed: 'Выполнено',
  cancelled: 'Отменено',
};

export const DECISION_STATUS_TONES: Record<DecisionStatus, BadgeTone> = {
  new: 'info',
  in_progress: 'accent',
  needs_review: 'warn',
  completed: 'ok',
  cancelled: 'idle',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

export const TASK_STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  new: 'info',
  in_progress: 'accent',
  completed: 'ok',
  cancelled: 'idle',
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  active: 'Активно',
  acknowledged: 'Ознакомление подтверждено',
  resolved: 'Устранено',
};

export const ALERT_STATUS_TONES: Record<AlertStatus, BadgeTone> = {
  active: 'bad',
  acknowledged: 'warn',
  resolved: 'ok',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  new: 'info',
  in_progress: 'accent',
  completed: 'ok',
  cancelled: 'idle',
};

export const MODERATION_LABELS: Record<ModerationStatus, string> = {
  pending: 'Ожидает модерации',
  approved: 'Согласовано',
  rejected: 'Отклонено',
  revision_required: 'Требует доработки',
};

export const PRODUCTION_LABELS: Record<ProductionStatus, string> = {
  queued: 'В очереди',
  in_progress: 'В работе',
  completed: 'Завершено',
  blocked: 'Заблокировано',
};

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  not_started: 'Не начата',
  in_transit: 'В пути',
  delivered: 'Доставлено',
  delayed: 'Задержка',
  returned: 'Возврат',
};

export const CHANNEL_LABELS: Record<string, string> = {
  website: 'Сайт picPac.by',
  mobile_app: 'Мобильное приложение',
  office: 'Офис продаж',
  marketplace: 'Маркетплейс',
  partner: 'Партнёрский канал',
};

export const SEGMENT_LABELS: Record<string, string> = {
  b2c: 'Розница',
  b2b: 'Корпоративные',
  vip: 'VIP-клиенты',
};

export const SOURCE_LABELS: Record<string, string> = {
  crm: 'CRM',
  erp: 'ERP / производство',
  finance: 'Финансы',
  support: 'Поддержка',
  hr: 'HR',
  system: 'Система',
};

export const DEAL_STAGE_LABELS: Record<string, string> = {
  new: 'Новая сделка',
  qualified: 'Квалифицирована',
  proposal: 'Предложение',
  won: 'Выиграна',
  lost: 'Проиграна',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Вход в систему',
  'auth.logout': 'Выход из системы',
  'auth.refresh': 'Обновление токена',
  'decision.created': 'Создание решения',
  'decision.updated': 'Изменение решения',
  'decision.status_changed': 'Смена статуса решения',
  'task.created': 'Создание задачи',
  'task.updated': 'Изменение задачи',
  'task.status_changed': 'Смена статуса задачи',
  'alert.created': 'Создание отклонения',
  'alert.acknowledged': 'Ознакомление с отклонением',
  'alert.resolved': 'Закрытие отклонения',
  'order.created': 'Создание заказа',
  'order.updated': 'Изменение заказа',
  'user.created': 'Создание пользователя',
  'user.updated': 'Изменение пользователя',
  'integration.import': 'Импорт источника',
  'data_quality.check': 'Проверка качества данных',
  'metrics.recalculate': 'Пересчёт KPI',
};

export const CHECK_TYPE_LABELS: Record<string, string> = {
  missing_fields: 'Отсутствующие обязательные значения',
  duplicates: 'Дубликаты записей',
  invalid_values: 'Некорректные значения',
  broken_relations: 'Нарушенные связи',
  financial_reconciliation: 'Финансовая сверка',
  stale_source: 'Устаревший источник',
};
