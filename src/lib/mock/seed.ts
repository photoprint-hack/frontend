import type {
  Alert,
  AuditLog,
  ChangeEvent,
  Customer,
  Decision,
  Department,
  OrderEvent,
  Product,
  Task,
} from '@/types/api';
import type { DealRecord, HrSnapshotRaw, OrderRecord, ProductionRecord, SupportTicket, User } from './internal-types';
import {
  addDays,
  atTime,
  createRng,
  DAY_MS,
  randomUuid,
  round,
  startOfDay,
  startOfMonth,
  toDateKey,
  toIso,
  uuidFrom,
} from './random';

export interface PlanRow {
  date: string;
  department_id: string;
  product_id: string;
  revenue_plan: number;
  quantity_plan: number;
  available_hours: number;
}

export interface MockStore {
  departments: Department[];
  users: User[];
  products: Product[];
  customers: Customer[];
  orders: OrderRecord[];
  orderEvents: OrderEvent[];
  production: ProductionRecord[];
  tickets: SupportTicket[];
  deals: DealRecord[];
  hrSnapshots: HrSnapshotRaw[];
  plans: PlanRow[];
  alerts: Alert[];
  decisions: Decision[];
  tasks: Task[];
  auditLogs: AuditLog[];
  decisionHistory: ChangeEvent[];
  taskHistory: ChangeEvent[];
  alertHistory: ChangeEvent[];
  referenceDate: string;
}

export const DEMO_PASSWORD = 'Demo12345678';

const DEPARTMENT_SEEDS = [
  { code: 'sales', name: 'Продажи', description: 'Работа с клиентами, каналы продаж и сопровождение заказов' },
  { code: 'production', name: 'Производство', description: 'Печать, постобработка и контроль качества выпуска' },
  { code: 'support', name: 'Поддержка', description: 'Клиентская поддержка, SLA и работа с обращениями' },
];

const PRODUCT_SEEDS = [
  { code: 'PHOTOBOOK', name: 'Фотокнига', category: 'photobooks', price: 84.5, hours: 1.2 },
  { code: 'CANVAS', name: 'Холст на подрамнике', category: 'wall-art', price: 126.0, hours: 0.9 },
  { code: 'PRINTS', name: 'Фотопечать 10×15', category: 'prints', price: 3.4, hours: 0.06 },
  { code: 'CALENDAR', name: 'Календарь настенный', category: 'calendars', price: 38.9, hours: 0.45 },
  { code: 'MUG', name: 'Кружка с принтом', category: 'souvenirs', price: 24.7, hours: 0.3 },
];

const CHANNELS = ['website', 'mobile_app', 'office', 'marketplace', 'partner'] as const;

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

const SUPPORT_TOPICS = [
  'Срок изготовления заказа',
  'Качество печати',
  'Изменить адрес доставки',
  'Повторный заказ',
  'Возврат и перепечатка',
  'Проблема с загрузкой фото',
  'Оплата и чек',
  'Повреждение при доставке',
];

const SUPPORT_CHANNELS = ['email', 'phone', 'chat', 'telegram'];

const DEFECT_CAUSES = [
  'Смещение калибровки печати',
  'Повреждение материала при постобработке',
  'Ошибка цветопрофиля',
  'Посторонние включения на отпечатке',
];

const CANCELLED_REASONS = [
  'Клиент отказался от заказа',
  'Не прошёл модерацию макета',
  'Дубликат заказа из CRM',
];

export function buildStore(referenceDate = new Date()): MockStore {
  const rng = createRng(20261112);
  const today = startOfDay(referenceDate);

  const departments: Department[] = DEPARTMENT_SEEDS.map((seed, index) => ({
    id: uuidFrom(0xd1, index + 1),
    name: seed.name,
    code: seed.code,
    description: seed.description,
    is_active: true,
    created_at: toIso(addDays(today, -400)),
    updated_at: toIso(addDays(today, -30)),
  }));
  const salesDept = departments[0]!;
  const productionDept = departments[1]!;
  const supportDept = departments[2]!;

  const products: Product[] = PRODUCT_SEEDS.map((seed, index) => ({
    id: uuidFrom(0x9a, index + 1),
    external_id: `ERP-P-${1000 + index}`,
    code: seed.code,
    name: seed.name,
    category: seed.category,
    standard_price: seed.price,
    currency: 'BYN',
    standard_hours_per_unit: seed.hours,
    is_active: true,
    created_at: toIso(addDays(today, -380)),
  }));

  const users: User[] = [
    {
      id: uuidFrom(0x11, 1),
      email: 'admin@photoprint.by',
      password: DEMO_PASSWORD,
      full_name: 'Администратор платформы',
      role: 'admin',
      department_id: null,
      is_active: true,
      created_at: toIso(addDays(today, -300)),
      updated_at: toIso(addDays(today, -10)),
    },
    {
      id: uuidFrom(0x11, 2),
      email: 'director@photoprint.by',
      password: DEMO_PASSWORD,
      full_name: 'Демо Директор',
      role: 'director',
      department_id: null,
      is_active: true,
      created_at: toIso(addDays(today, -300)),
      updated_at: toIso(addDays(today, -10)),
    },
    {
      id: uuidFrom(0x11, 3),
      email: 'manager@photoprint.by',
      password: DEMO_PASSWORD,
      full_name: 'Демо Руководитель производства',
      role: 'manager',
      department_id: productionDept.id,
      is_active: true,
      created_at: toIso(addDays(today, -280)),
      updated_at: toIso(addDays(today, -8)),
    },
    {
      id: uuidFrom(0x11, 4),
      email: 'analyst@photoprint.by',
      password: DEMO_PASSWORD,
      full_name: 'Демо Аналитик',
      role: 'analyst',
      department_id: null,
      is_active: true,
      created_at: toIso(addDays(today, -260)),
      updated_at: toIso(addDays(today, -8)),
    },
    {
      id: uuidFrom(0x11, 5),
      email: 'employee@photoprint.by',
      password: DEMO_PASSWORD,
      full_name: 'Демо Сотрудник',
      role: 'employee',
      department_id: productionDept.id,
      is_active: true,
      created_at: toIso(addDays(today, -240)),
      updated_at: toIso(addDays(today, -5)),
    },
    {
      id: uuidFrom(0x11, 6),
      email: 'manager.sales@photoprint.by',
      password: DEMO_PASSWORD,
      full_name: 'Демо Руководитель продаж',
      role: 'manager',
      department_id: salesDept.id,
      is_active: true,
      created_at: toIso(addDays(today, -230)),
      updated_at: toIso(addDays(today, -5)),
    },
    {
      id: uuidFrom(0x11, 7),
      email: 'manager.support@photoprint.by',
      password: DEMO_PASSWORD,
      full_name: 'Демо Руководитель поддержки',
      role: 'manager',
      department_id: supportDept.id,
      is_active: true,
      created_at: toIso(addDays(today, -220)),
      updated_at: toIso(addDays(today, -5)),
    },
  ];

  const customers: Customer[] = Array.from({ length: 210 }, (_, index) => {
    const type = rng.chance(0.28) ? 'b2b' : 'b2c';
    return {
      id: uuidFrom(0xc0, index + 1),
      external_id: `CRM-${10000 + index}`,
      name:
        type === 'b2b'
          ? `Клиент B2B ${String(index + 1).padStart(3, '0')}`
          : `Клиент ${String(index + 1).padStart(3, '0')}`,
      segment: rng.weighted([
        ['b2c', 6],
        ['b2b', 3],
        ['vip', 1],
      ] as const),
      source: 'crm',
      customer_type: type,
      acquisition_channel: rng.pick(CHANNELS),
      first_order_at: null,
      created_at: toIso(addDays(today, -rng.int(10, 420))),
      updated_at: toIso(addDays(today, -rng.int(0, 20))),
    };
  });

  const plans: PlanRow[] = [];
  for (let dayOffset = -210; dayOffset <= 34; dayOffset += 1) {
    const date = addDays(today, dayOffset);
    const dateKey = toDateKey(date);
    const weekday = date.getDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.55 : 1;
    const seasonFactor = 1 + Math.sin((dayOffset / 30) * Math.PI) * 0.12;
    departments.forEach((department) => {
      products.forEach((product) => {
        const baseRevenue = (department.code === 'production' ? 1850 : 1250) * seasonFactor;
        const productWeight =
          product.category === 'prints' ? 1.5 : product.category === 'photobooks' ? 1.1 : 0.7;
        const revenuePlan = round(baseRevenue * productWeight * weekendFactor * rng.float(0.92, 1.08), 2);
        const quantityPlan = Math.max(1, Math.round(revenuePlan / product.standard_price));
        const hoursPerDay = department.code === 'production' ? 46 : 26;
        plans.push({
          date: dateKey,
          department_id: department.id,
          product_id: product.id,
          revenue_plan: revenuePlan,
          quantity_plan: quantityPlan,
          available_hours: round(hoursPerDay * weekendFactor * productWeight * 0.42, 2),
        });
      });
    });
  }

  const orders: OrderRecord[] = [];
  const orderEvents: OrderEvent[] = [];
  const customerFirstOrder = new Map<string, string>();

  for (let index = 0; index < 520; index += 1) {
    const customer = rng.pick(customers);
    const product = rng.pick(products);
    const createdOffset = index < 90 ? -rng.int(0, 12) : -rng.int(13, 190);
    const createdAt = atTime(addDays(today, createdOffset), rng.int(8, 20), rng.int(0, 59));
    const dueAt = atTime(addDays(createdAt, rng.int(3, 14)), 18, 0);
    const quantity = product.category === 'prints' ? rng.int(10, 120) : rng.int(1, 6);
    const amount = round(product.standard_price * quantity * rng.float(0.94, 1.12), 2);
    const recent = createdOffset > -10;

    const status = rng.weighted(
      recent
        ? ([
            ['completed', 30],
            ['in_progress', 45],
            ['new', 21],
            ['cancelled', 4],
          ] as const)
        : ([
            ['completed', 82],
            ['in_progress', 6],
            ['new', 3],
            ['cancelled', 9],
          ] as const),
    );

    const maxCycle = Math.max(2, Math.min(16, Math.abs(createdOffset)));
    const completedAt =
      status === 'completed'
        ? atTime(addDays(createdAt, rng.int(1, maxCycle)), rng.int(9, 19), rng.int(0, 59))
        : null;

    const hasDefect = status === 'completed' && rng.chance(0.07);
    const moderationStatus = status === 'new' ? 'pending' : rng.chance(0.05) ? 'revision_required' : 'approved';
    const productionStatus =
      status === 'new'
        ? 'queued'
        : status === 'completed'
          ? 'completed'
          : rng.weighted([
              ['in_progress', 7],
              ['queued', 2],
              ['blocked', 1],
            ] as const);
    const deliveryStatus =
      status === 'completed'
        ? rng.weighted([
            ['delivered', 9],
            ['returned', 1],
          ] as const)
        : status === 'cancelled'
          ? 'not_started'
          : rng.weighted([
              ['not_started', 5],
              ['in_transit', 3],
              ['delayed', 1],
            ] as const);

    const order: OrderRecord = {
      id: uuidFrom(0x0d, index + 1),
      order_number: `FP-${String(100000 + index).slice(1)}`,
      customer_id: customer.id,
      customer_name: customer.name,
      product_id: product.id,
      product_name: product.name,
      department_id: productionDept.id,
      department_name: productionDept.name,
      amount,
      currency: 'BYN',
      status,
      channel: customer.acquisition_channel,
      quantity,
      standard_hours_per_unit: product.standard_hours_per_unit,
      created_at: toIso(createdAt),
      due_at: toIso(dueAt),
      completed_at: completedAt ? toIso(completedAt) : null,
      updated_at: toIso(completedAt ?? addDays(createdAt, 1)),
      has_defect: hasDefect,
      source_system: 'erp',
      moderation_status: moderationStatus,
      production_status: productionStatus,
      delivery_status: deliveryStatus,
      campaign_id: null,
      crm_deal_id: null,
      version: 1,
      allowed_actions: ['read', 'update'],
      direct_cost: round(amount * rng.float(0.54, 0.71), 2),
    };
    orders.push(order);

    if (completedAt) {
      const completedKey = toIso(completedAt);
      const existing = customerFirstOrder.get(customer.id);
      if (!existing || completedKey < existing) customerFirstOrder.set(customer.id, completedKey);
    }

    orderEvents.push({
      id: randomUuid(rng),
      order_id: order.id,
      event_type: 'order_created',
      result: 'Заказ создан и передан в обработку',
      occurred_at: toIso(createdAt),
      source_system: 'erp',
      old_status: null,
      new_status: 'new',
      actor: { id: users[2]!.id, full_name: users[2]!.full_name },
      department_id: productionDept.id,
      description: `Канал: ${CHANNEL_LABELS[order.channel] ?? order.channel}`,
      cause: null,
      created_at: toIso(createdAt),
    });

    if (moderationStatus === 'approved' || moderationStatus === 'revision_required') {
      const at = atTime(addDays(createdAt, 1), 11, 15);
      orderEvents.push({
        id: randomUuid(rng),
        order_id: order.id,
        event_type: 'moderation_passed',
        result:
          moderationStatus === 'approved'
            ? 'Макет согласован модератором'
            : 'Макет возвращён на доработку',
        occurred_at: toIso(at),
        source_system: 'erp',
        old_status: 'pending',
        new_status: moderationStatus,
        actor: { id: users[2]!.id, full_name: users[2]!.full_name },
        department_id: productionDept.id,
        description: null,
        cause: moderationStatus === 'approved' ? null : 'Недостаточное разрешение изображения',
        created_at: toIso(at),
      });
    }

    if (productionStatus !== 'queued' && status !== 'new') {
      const at = atTime(addDays(createdAt, 2), 9, 40);
      orderEvents.push({
        id: randomUuid(rng),
        order_id: order.id,
        event_type: 'production_started',
        result: 'Заказ передан в производство',
        occurred_at: toIso(at),
        source_system: 'erp',
        old_status: 'queued',
        new_status: productionStatus === 'blocked' ? 'blocked' : 'in_progress',
        actor: { id: users[4]!.id, full_name: users[4]!.full_name },
        department_id: productionDept.id,
        description: null,
        cause: productionStatus === 'blocked' ? 'Ожидание материала' : null,
        created_at: toIso(at),
      });
    }

    if (completedAt) {
      orderEvents.push({
        id: randomUuid(rng),
        order_id: order.id,
        event_type: 'production_completed',
        result: 'Производство завершено, заказ передан на доставку',
        occurred_at: toIso(completedAt),
        source_system: 'erp',
        old_status: 'in_progress',
        new_status: 'completed',
        actor: { id: users[4]!.id, full_name: users[4]!.full_name },
        department_id: productionDept.id,
        description: null,
        cause: null,
        created_at: toIso(completedAt),
      });
      if (deliveryStatus === 'delivered') {
        const deliveredAt = atTime(addDays(completedAt, rng.int(1, 3)), 14, 0);
        orderEvents.push({
          id: randomUuid(rng),
          order_id: order.id,
          event_type: 'delivered',
          result: 'Заказ получен клиентом',
          occurred_at: toIso(deliveredAt),
          source_system: 'erp',
          old_status: 'in_transit',
          new_status: 'delivered',
          actor: null,
          department_id: productionDept.id,
          description: 'Курьерская доставка',
          cause: null,
          created_at: toIso(deliveredAt),
        });
      }
      if (deliveryStatus === 'returned') {
        const returnedAt = atTime(addDays(completedAt, 4), 16, 0);
        orderEvents.push({
          id: randomUuid(rng),
          order_id: order.id,
          event_type: 'returned',
          result: 'Оформлен возврат, назначена перепечатка',
          occurred_at: toIso(returnedAt),
          source_system: 'support',
          old_status: 'delivered',
          new_status: 'returned',
          actor: { id: users[6]!.id, full_name: users[6]!.full_name },
          department_id: productionDept.id,
          description: 'Повреждение при доставке',
          cause: 'Повреждение упаковки перевозчиком',
          created_at: toIso(returnedAt),
        });
      }
    }

    if (status === 'cancelled') {
      const at = atTime(addDays(createdAt, 2), 12, 30);
      orderEvents.push({
        id: randomUuid(rng),
        order_id: order.id,
        event_type: 'order_cancelled',
        result: 'Заказ отменён',
        occurred_at: toIso(at),
        source_system: 'erp',
        old_status: 'new',
        new_status: 'cancelled',
        actor: { id: users[1]!.id, full_name: users[1]!.full_name },
        department_id: productionDept.id,
        description: null,
        cause: rng.pick(CANCELLED_REASONS),
        created_at: toIso(at),
      });
    }
  }

  customers.forEach((customer) => {
    customer.first_order_at = customerFirstOrder.get(customer.id) ?? null;
  });

  const completedOrders = orders.filter((order) => order.status === 'completed' && order.completed_at);

  const production: ProductionRecord[] = completedOrders.slice(0, 130).map((order, index) => {
    const date = startOfDay(new Date(order.completed_at as string));
    const defective = order.has_defect ? Math.max(1, Math.round(order.quantity * 0.08)) : 0;
    return {
      id: uuidFrom(0x9f, index + 1),
      external_id: `ERP-PR-${2000 + index}`,
      order_id: order.id,
      product_id: order.product_id,
      product_name: order.product_name,
      department_id: order.department_id,
      department_name: order.department_name,
      production_date: toDateKey(date),
      planned_quantity: order.quantity,
      actual_quantity: order.quantity,
      defective_quantity: defective,
      reprint_quantity: defective,
      queue_quantity: rng.int(0, 12),
      downtime_minutes: rng.chance(0.35) ? rng.int(10, 180) : 0,
      planned_capacity: round(order.quantity * order.standard_hours_per_unit * 1.15, 2),
      actual_load: round(order.quantity * order.standard_hours_per_unit, 2),
      lead_time_hours: round(rng.float(6, 68), 1),
      cause: defective > 0 ? rng.pick(DEFECT_CAUSES) : null,
    };
  });

  const tickets: SupportTicket[] = Array.from({ length: 320 }, (_, index) => {
    const order = rng.pick(orders);
    const createdAt = atTime(addDays(today, -rng.int(0, 190)), rng.int(8, 20), rng.int(0, 59));
    const closed = rng.chance(0.82);
    const closedAt = closed ? atTime(addDays(createdAt, rng.int(0, 4)), rng.int(9, 21), rng.int(0, 59)) : null;
    const slaDeadline = atTime(addDays(createdAt, rng.int(1, 3)), 18, 0);
    const resolvedWithinSla = closedAt ? closedAt.getTime() <= slaDeadline.getTime() : null;
    return {
      id: uuidFrom(0x7c, index + 1),
      external_id: `SUP-${5000 + index}`,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      order_id: order.id,
      department_id: supportDept.id,
      channel: rng.pick(SUPPORT_CHANNELS),
      topic: rng.pick(SUPPORT_TOPICS),
      status: closed ? 'closed' : rng.chance(0.5) ? 'open' : 'in_progress',
      priority: rng.weighted([
        ['low', 3],
        ['medium', 5],
        ['high', 2],
      ] as const),
      created_at: toIso(createdAt),
      first_response_at: toIso(
        atTime(createdAt, createdAt.getHours(), Math.min(59, createdAt.getMinutes() + rng.int(3, 40))),
      ),
      closed_at: closedAt ? toIso(closedAt) : null,
      sla_deadline: toIso(slaDeadline),
      resolved_within_sla: resolvedWithinSla,
      resolution: closed
        ? rng.pick(['Проблема решена', 'Оформлена перепечатка', 'Клиент получил консультацию', 'Заказ переназначен'])
        : null,
      cause:
        resolvedWithinSla === false
          ? rng.pick(['Высокая очередь обращений', 'Ожидание ответа производства', 'Ошибка маршрутизации'])
          : null,
    };
  });

  const deals: DealRecord[] = Array.from({ length: 210 }, (_, index) => {
    const customer = rng.pick(customers);
    const product = rng.pick(products);
    const createdAt = atTime(addDays(today, -rng.int(0, 120)), rng.int(9, 18), rng.int(0, 59));
    const stage = rng.weighted([
      ['new', 4],
      ['qualified', 3],
      ['proposal', 3],
      ['won', 5],
      ['lost', 3],
    ] as const);
    const linkedOrder = stage === 'won' ? rng.pick(completedOrders) : null;
    const stageIndex = ['new', 'qualified', 'proposal', 'won', 'lost'].indexOf(stage);
    return {
      id: uuidFrom(0x4e, index + 1),
      external_id: `DEAL-${8000 + index}`,
      customer_id: customer.id,
      customer_name: customer.name,
      product_id: product.id,
      department_id: salesDept.id,
      campaign_id: null,
      channel: customer.acquisition_channel,
      segment: customer.segment,
      stage,
      expected_amount: round(product.standard_price * rng.int(1, 6), 2),
      currency: 'BYN',
      order_id: linkedOrder?.id ?? null,
      created_at: toIso(createdAt),
      updated_at: toIso(addDays(createdAt, rng.int(0, 6))),
      stageIndex,
    };
  });

  const hrSnapshots: HrSnapshotRaw[] = [];
  for (let monthOffset = 11; monthOffset >= 0; monthOffset -= 1) {
    const snapshotDate = startOfMonth(addDays(today, -monthOffset * 30));
    departments.forEach((department, index) => {
      const planned = [26, 34, 18][index] ?? 24;
      const actual = planned - rng.int(0, 4);
      hrSnapshots.push({
        id: uuidFrom(0x44, hrSnapshots.length + 1),
        department_id: department.id,
        snapshot_date: toDateKey(snapshotDate),
        planned_headcount: planned,
        actual_headcount: actual,
        available_headcount: Math.max(1, actual - rng.int(0, 2)),
        required_headcount: planned,
        vacancies_count: Math.max(0, planned - actual),
        absences_count: rng.int(0, 3),
        source_system: 'hr',
        created_at: toIso(snapshotDate),
      });
    });
  }

  const alerts: Alert[] = [];
  const decisions: Decision[] = [];
  const tasks: Task[] = [];
  const auditLogs: AuditLog[] = [];
  const decisionHistory: ChangeEvent[] = [];
  const taskHistory: ChangeEvent[] = [];
  const alertHistory: ChangeEvent[] = [];

  const monthStart = startOfMonth(today);
  const monthEnd = addDays(monthStart, 29);

  const alertSeeds = [
    {
      code: 'revenue',
      name: 'Оборот',
      title: 'Отклонение по обороту',
      description: 'Фактическая выручка ниже плана в производственном подразделении',
      deviation: -14.6,
      actual: 118450.2,
      target: 138700,
      department: productionDept,
      product: products[0]!,
      status: 'active' as const,
    },
    {
      code: 'defect_rate',
      name: 'Доля брака',
      title: 'Рост доли брака',
      description: 'Доля брака превышает целевое значение после смены партии материала',
      deviation: 18.2,
      actual: 7.8,
      target: 4.5,
      department: productionDept,
      product: products[1]!,
      status: 'acknowledged' as const,
    },
    {
      code: 'support_sla',
      name: 'Соблюдение SLA поддержки',
      title: 'Нарушение SLA поддержки',
      description: 'Часть обращений закрыта позже согласованного срока',
      deviation: -11.4,
      actual: 82.1,
      target: 94,
      department: supportDept,
      product: null,
      status: 'active' as const,
    },
    {
      code: 'sales_plan_achievement',
      name: 'Выполнение плана продаж',
      title: 'План продаж под угрозой',
      description: 'Отставание от плана по каналу «Маркетплейс»',
      deviation: -12.3,
      actual: 87.7,
      target: 100,
      department: salesDept,
      product: products[3]!,
      status: 'resolved' as const,
    },
  ];

  alertSeeds.forEach((seed, index) => {
    const createdAt = atTime(addDays(monthStart, Math.min(9, index + 2)), 9, 30);
    const alert: Alert = {
      id: uuidFrom(0xa1, index + 1),
      metric_value_id: null,
      title: seed.title,
      description: seed.description,
      severity: 'critical',
      deviation_percent: seed.deviation,
      status: seed.status,
      department_id: seed.department.id,
      department_name: seed.department.name,
      created_at: toIso(createdAt),
      updated_at: toIso(addDays(createdAt, 1)),
      metric_code: seed.code,
      metric_name: seed.name,
      product_id: seed.product?.id ?? null,
      product_name: seed.product?.name ?? null,
      period_start: toDateKey(monthStart),
      period_end: toDateKey(monthEnd),
      actual: seed.actual,
      target: seed.target,
      opening_actual: seed.actual,
      opening_target: seed.target,
      has_decision: index < 2,
      allowed_actions: ['read', 'acknowledge', 'resolve'],
    };
    alerts.push(alert);
    alertHistory.push({
      id: randomUuid(rng),
      object_type: 'alert',
      object_id: alert.id,
      action: 'alert.created',
      changed_by: null,
      old_values: {},
      new_values: { status: 'active' },
      comment: 'Сигнал сформирован пересчётом KPI',
      created_at: toIso(createdAt),
    });
    if (seed.status !== 'active') {
      alertHistory.push({
        id: randomUuid(rng),
        object_type: 'alert',
        object_id: alert.id,
        action: seed.status === 'resolved' ? 'alert.resolved' : 'alert.acknowledged',
        changed_by: { id: users[1]!.id, full_name: users[1]!.full_name },
        old_values: { status: 'active' },
        new_values: { status: seed.status },
        comment:
          seed.status === 'resolved'
            ? 'Показатель восстановлен после корректировки'
            : 'Ознакомление подтверждено',
        created_at: toIso(addDays(createdAt, 2)),
      });
    }
  });

  const decisionSeeds = [
    {
      title: 'Стабилизировать калибровку печати',
      problem: 'Доля брака выросла до 7.8% при цели 4.5%',
      impact: 'Потери материала и повторные печати, риск срыва сроков по 12 заказам',
      cause: 'Смена партии материала без повторной калибровки цветопрофиля',
      action: 'Провести калибровку оборудования и ввести контрольный оттиск в начале смены',
      priority: 'high' as const,
      status: 'in_progress' as const,
      expected: 'Доля брака не выше 4.5% в течение двух недель',
      actual: null,
      department: productionDept,
      owner: users[2]!,
      alertIndex: 1,
      createdOffset: -9,
      deadlineOffset: 5,
    },
    {
      title: 'Ускорить обработку обращений поддержки',
      problem: 'SLA поддержки 82.1% при цели 94%',
      impact: 'Снижение удовлетворённости клиентов и риск повторных обращений',
      cause: 'Пиковая нагрузка и отсутствие маршрутизации по темам',
      action: 'Ввести правила маршрутизации и временный усиленный график',
      priority: 'critical' as const,
      status: 'needs_review' as const,
      expected: 'SLA не ниже 94% по итогам месяца',
      actual: 'SLA вырос до 91.4% после введения маршрутизации',
      department: supportDept,
      owner: users[6]!,
      alertIndex: 2,
      createdOffset: -7,
      deadlineOffset: 2,
    },
    {
      title: 'Восстановить план продаж по маркетплейсу',
      problem: 'Отставание от плана 12.3% в канале «Маркетплейс»',
      impact: 'Недовыполнение месячного плана продаж',
      cause: 'Снижение трафика и рост стоимости размещения',
      action: 'Перераспределить бюджет кампаний и обновить карточки товаров',
      priority: 'medium' as const,
      status: 'completed' as const,
      expected: 'Возврат к плану в течение трёх недель',
      actual: 'Канал вернулся к плановым значениям, отклонение менее 3%',
      department: salesDept,
      owner: users[5]!,
      alertIndex: 3,
      createdOffset: -21,
      deadlineOffset: -4,
    },
    {
      title: 'Снизить очередь производства перед сезоном',
      problem: 'Очередь заказов превышает норматив на 18%',
      impact: 'Рост lead time и риск нарушения сроков доставки',
      cause: 'Неравномерная загрузка мощностей по неделям',
      action: 'Ввести дополнительную смену на две недели',
      priority: 'high' as const,
      status: 'new' as const,
      expected: 'Очередь не более 40 единиц',
      actual: null,
      department: productionDept,
      owner: users[2]!,
      alertIndex: null,
      createdOffset: -3,
      deadlineOffset: 9,
    },
    {
      title: 'Актуализировать нормативы времени по фотокнигам',
      problem: 'Норматив 1.2 нормо-часа не отражает фактическую трудоёмкость',
      impact: 'Искажение прогноза спроса и загрузки мощностей',
      cause: 'Изменение технологического процесса без обновления справочника',
      action: 'Пересчитать нормативы по фактическим данным за 8 недель',
      priority: 'low' as const,
      status: 'cancelled' as const,
      expected: 'Нормативы соответствуют факту с отклонением до 5%',
      actual: null,
      department: productionDept,
      owner: users[3]!,
      alertIndex: null,
      createdOffset: -30,
      deadlineOffset: -10,
    },
  ];

  decisionSeeds.forEach((seed, index) => {
    const createdAt = atTime(addDays(today, seed.createdOffset), 10, 15);
    const deadline = atTime(addDays(today, seed.deadlineOffset), 18, 0);
    const linkedAlert = seed.alertIndex === null ? null : alerts[seed.alertIndex]!;
    const decision: Decision = {
      id: uuidFrom(0xde, index + 1),
      title: seed.title,
      problem: seed.problem,
      impact: seed.impact,
      cause: seed.cause,
      action: seed.action,
      department_id: seed.department.id,
      department_name: seed.department.name,
      owner_id: seed.owner.id,
      owner: { id: seed.owner.id, full_name: seed.owner.full_name },
      created_by: users[1]!.id,
      creator: { id: users[1]!.id, full_name: users[1]!.full_name },
      alert_id: linkedAlert?.id ?? null,
      alert_title: linkedAlert?.title ?? null,
      deadline: toIso(deadline),
      priority: seed.priority,
      status: seed.status,
      expected_result: seed.expected,
      actual_result: seed.actual,
      verification_note:
        seed.status === 'completed' ? 'Результат подтверждён директором по данным дашборда' : null,
      created_at: toIso(createdAt),
      updated_at: toIso(addDays(createdAt, 1)),
      completed_at: seed.status === 'completed' ? toIso(addDays(today, -3)) : null,
      version: seed.status === 'new' ? 1 : 2,
      allowed_actions: ['read', 'update', 'cancel'],
    };
    decisions.push(decision);
    decisionHistory.push({
      id: randomUuid(rng),
      object_type: 'decision',
      object_id: decision.id,
      action: 'decision.created',
      changed_by: decision.creator,
      old_values: {},
      new_values: { title: decision.title, status: 'new', priority: decision.priority },
      comment: 'Решение создано из карточки отклонения',
      created_at: toIso(createdAt),
    });
    if (seed.status !== 'new') {
      decisionHistory.push({
        id: randomUuid(rng),
        object_type: 'decision',
        object_id: decision.id,
        action: 'decision.updated',
        changed_by: decision.creator,
        old_values: { status: 'new' },
        new_values: { status: seed.status },
        comment:
          seed.status === 'completed'
            ? 'Проверка результата подтверждена'
            : 'Статус обновлён ответственным',
        created_at: toIso(addDays(createdAt, 1)),
      });
    }
  });

  const taskSeeds = [
    {
      title: 'Проверить контрольные оттиски за смену',
      decisionIndex: 0,
      assignee: users[4]!,
      priority: 'high' as const,
      status: 'in_progress' as const,
      offset: 2,
    },
    {
      title: 'Собрать статистику SLA за неделю',
      decisionIndex: 1,
      assignee: users[6]!,
      priority: 'critical' as const,
      status: 'new' as const,
      offset: 1,
    },
    {
      title: 'Обновить карточки товаров маркетплейса',
      decisionIndex: 2,
      assignee: users[5]!,
      priority: 'medium' as const,
      status: 'completed' as const,
      offset: -2,
    },
    {
      title: 'Согласовать дополнительную смену',
      decisionIndex: 3,
      assignee: users[2]!,
      priority: 'high' as const,
      status: 'new' as const,
      offset: -1,
    },
    {
      title: 'Проверить причины перепечаток',
      decisionIndex: 0,
      assignee: users[4]!,
      priority: 'medium' as const,
      status: 'new' as const,
      offset: 4,
    },
    {
      title: 'Подготовить сводку по дефектам для директора',
      decisionIndex: 1,
      assignee: users[3]!,
      priority: 'low' as const,
      status: 'in_progress' as const,
      offset: 3,
    },
    {
      title: 'Проверить выгрузку из CRM',
      decisionIndex: null,
      assignee: users[3]!,
      priority: 'medium' as const,
      status: 'completed' as const,
      offset: -5,
    },
    {
      title: 'Верифицировать финансовую сверку',
      decisionIndex: null,
      assignee: users[3]!,
      priority: 'high' as const,
      status: 'new' as const,
      offset: 0,
    },
  ];

  taskSeeds.forEach((seed, index) => {
    const createdAt = atTime(addDays(today, -Math.abs(seed.offset) - 2), 9, 20);
    const deadline = atTime(addDays(today, seed.offset), 18, 0);
    const decision = seed.decisionIndex === null ? null : decisions[seed.decisionIndex]!;
    const task: Task = {
      id: uuidFrom(0x7a, index + 1),
      title: seed.title,
      description: `${seed.title}. Синтетическая демонстрационная задача.`,
      assignee_id: seed.assignee.id,
      assignee: { id: seed.assignee.id, full_name: seed.assignee.full_name },
      created_by: users[1]!.id,
      creator: { id: users[1]!.id, full_name: users[1]!.full_name },
      department_id: decision?.department_id ?? seed.assignee.department_id ?? productionDept.id,
      department_name: decision?.department_name ?? productionDept.name,
      decision_id: decision?.id ?? null,
      decision_title: decision?.title ?? null,
      alert_id: decision?.alert_id ?? null,
      alert_title: decision?.alert_title ?? null,
      order_id: index === 4 ? orders[3]!.id : null,
      deadline: toIso(deadline),
      priority: seed.priority,
      status: seed.status,
      is_overdue: seed.status !== 'completed' && deadline.getTime() < today.getTime(),
      created_at: toIso(createdAt),
      updated_at: toIso(addDays(createdAt, 1)),
      completed_at: seed.status === 'completed' ? toIso(addDays(today, -1)) : null,
      version: seed.status === 'new' ? 1 : 2,
      allowed_actions: ['read', 'start'],
    };
    tasks.push(task);
    taskHistory.push({
      id: randomUuid(rng),
      object_type: 'task',
      object_id: task.id,
      action: 'task.created',
      changed_by: task.creator,
      old_values: {},
      new_values: { title: task.title, status: 'new', priority: task.priority },
      comment: null,
      created_at: toIso(createdAt),
    });
    if (seed.status !== 'new') {
      taskHistory.push({
        id: randomUuid(rng),
        object_type: 'task',
        object_id: task.id,
        action: 'task.status_changed',
        changed_by: { id: seed.assignee.id, full_name: seed.assignee.full_name },
        old_values: { status: 'new' },
        new_values: { status: seed.status },
        comment: null,
        created_at: toIso(addDays(createdAt, 1)),
      });
    }
  });

  const auditTemplates: { action: string; object: string; name: string }[] = [
    { action: 'auth.login', object: 'session', name: 'Вход в систему' },
    { action: 'decision.updated', object: 'decision', name: decisions[0]!.title },
    { action: 'task.status_changed', object: 'task', name: tasks[0]!.title },
    { action: 'order.updated', object: 'order', name: orders[5]!.order_number },
    { action: 'alert.acknowledged', object: 'alert', name: alerts[1]!.title },
    { action: 'data_quality.check', object: 'source', name: 'Проверка качества данных' },
    { action: 'integration.import', object: 'source', name: 'Импорт ERP' },
    { action: 'auth.logout', object: 'session', name: 'Выход из системы' },
    { action: 'user.updated', object: 'user', name: users[4]!.full_name },
    { action: 'decision.created', object: 'decision', name: decisions[3]!.title },
  ];

  const activeUsers = users.filter((user) => user.is_active);

  for (let index = 0; index < 140; index += 1) {
    const template = auditTemplates[index % auditTemplates.length]!;
    const actor = rng.pick(activeUsers);
    const createdAt = atTime(addDays(today, -rng.int(0, 45)), rng.int(8, 20), rng.int(0, 59));
    const failed = rng.chance(0.08);
    const isChange = template.action.includes('updated') || template.action.includes('status');
    auditLogs.push({
      id: uuidFrom(0xae, index + 1),
      user_id: actor.id,
      actor: { id: actor.id, full_name: actor.full_name },
      actor_type: 'user',
      action: template.action,
      object_type: template.object,
      object_id: template.object === 'order' ? orders[5]!.id : randomUuid(rng),
      object_name: template.name,
      old_values: isChange ? { status: 'new' } : null,
      new_values: isChange ? { status: 'in_progress' } : null,
      details: { source: 'mock', channel: 'web' },
      ip_address: `10.10.${rng.int(0, 8)}.${rng.int(2, 240)}`,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhotoprintDemo/1.0',
      status: failed ? 'failure' : 'success',
      error_message: failed ? 'Недостаточно прав для выполнения операции' : null,
      request_id: randomUuid(rng),
      created_at: toIso(createdAt),
    });
  }

  return {
    departments,
    users,
    products,
    customers,
    orders,
    orderEvents,
    production,
    tickets,
    deals,
    hrSnapshots,
    plans,
    alerts,
    decisions,
    tasks,
    auditLogs,
    decisionHistory,
    taskHistory,
    alertHistory,
    referenceDate: toDateKey(today),
  };
}

export const MS_DAY = DAY_MS;
