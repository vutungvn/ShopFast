/**
 * Seed tài khoản mẫu và đơn hàng ở đủ 7 trạng thái (gọi từ seed.ts sau khi có sản phẩm).
 * - Tài khoản: admin@ / kho@ / cskh@shopfast.vn và khach01..N@shopfast.vn, chung mật khẩu SEED_PASSWORD.
 * - Đơn mẫu có mã `SF-YYMMDD-0NNN`: mã thật không bao giờ chứa số 0 nên không trùng, và nhận ra được
 *   để chạy lại không tạo thêm (bỏ qua số thứ tự đã có).
 * Đơn chưa huỷ trừ tồn kho thật (có kiểm tra đủ hàng); lịch sử trạng thái đi đúng từng bước.
 */
import { OrderStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'MatKhau123';
const CUSTOMER_COUNT = Number(process.env.SEED_CUSTOMERS ?? 20);
// Mã đơn mẫu có 3 chữ số thứ tự
const ORDER_COUNT = Math.min(Number(process.env.SEED_ORDERS ?? 120), 999);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const VN_OFFSET = 7 * HOUR;

type Random = () => number;

const STAFF = [
  { email: 'admin@shopfast.vn', fullName: 'Quản trị viên', role: Role.ADMIN },
  { email: 'kho@shopfast.vn', fullName: 'Trần Văn Kho', role: Role.WAREHOUSE },
  { email: 'cskh@shopfast.vn', fullName: 'Lê Thị Hỗ Trợ', role: Role.SUPPORT },
];
const SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi'];
const MIDDLE = ['Văn', 'Thị', 'Minh', 'Thu', 'Đức', 'Ngọc', 'Quốc', 'Hải'];
const GIVEN = [
  'An',
  'Bình',
  'Chi',
  'Dũng',
  'Hà',
  'Khoa',
  'Lan',
  'Nam',
  'Phương',
  'Tú',
];
const ADDRESSES = [
  '12 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
  '88 Nguyễn Trãi, Thanh Xuân, Hà Nội',
  '25 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
  '140 Cách Mạng Tháng 8, Quận 3, TP. Hồ Chí Minh',
  '7 Bạch Đằng, Hải Châu, Đà Nẵng',
  '56 Trần Phú, Ninh Kiều, Cần Thơ',
];

/**
 * Trạng thái đích và tỉ lệ. Đơn huỷ chia theo ai huỷ: khách, kho, hay hệ thống tự huỷ do quá hạn.
 */
type Scenario =
  | { kind: 'flow'; status: OrderStatus }
  | {
      kind: 'cancel';
      by: 'customer-pending' | 'customer-paid' | 'staff' | 'system';
    };
const SCENARIOS: Array<[Scenario, number]> = [
  [{ kind: 'flow', status: OrderStatus.PENDING_PAYMENT }, 10],
  [{ kind: 'flow', status: OrderStatus.PAID }, 14],
  [{ kind: 'flow', status: OrderStatus.CONFIRMED }, 10],
  [{ kind: 'flow', status: OrderStatus.PACKING }, 10],
  [{ kind: 'flow', status: OrderStatus.SHIPPING }, 12],
  [{ kind: 'flow', status: OrderStatus.DELIVERED }, 30],
  [{ kind: 'cancel', by: 'customer-pending' }, 4],
  [{ kind: 'cancel', by: 'customer-paid' }, 3],
  [{ kind: 'cancel', by: 'staff' }, 3],
  [{ kind: 'cancel', by: 'system' }, 4],
];
const FORWARD: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKING,
  OrderStatus.SHIPPING,
  OrderStatus.DELIVERED,
];

interface Step {
  toStatus: OrderStatus;
  by: 'customer' | 'staff' | 'system';
  note: string | null;
}

/** Các bước sau khi tạo đơn (PENDING_PAYMENT) để tới trạng thái của kịch bản */
function stepsFor(scenario: Scenario): Step[] {
  const paid: Step = {
    toStatus: OrderStatus.PAID,
    by: 'customer',
    note: 'Thanh toán (giả lập)',
  };
  const forward = (until: OrderStatus): Step[] =>
    FORWARD.slice(0, FORWARD.indexOf(until) + 1).map((toStatus) =>
      toStatus === OrderStatus.PAID
        ? paid
        : { toStatus, by: 'staff', note: null },
    );
  const cancel = (by: Step['by'], note: string): Step => ({
    toStatus: OrderStatus.CANCELLED,
    by,
    note,
  });

  if (scenario.kind === 'flow') {
    return scenario.status === OrderStatus.PENDING_PAYMENT
      ? []
      : forward(scenario.status);
  }
  switch (scenario.by) {
    case 'customer-pending':
      return [cancel('customer', 'Đặt nhầm sản phẩm')];
    case 'customer-paid':
      return [paid, cancel('customer', 'Đổi ý · Hoàn tiền (giả lập)')];
    case 'staff':
      return [
        ...forward(OrderStatus.PACKING),
        cancel('staff', 'Không liên lạc được khách · Hoàn tiền (giả lập)'),
      ];
    case 'system':
      return [cancel('system', 'Tự huỷ do quá hạn thanh toán')];
  }
}

/** Mã đơn mẫu: ngày giờ VN + "0" + số thứ tự (mã thật không chứa số 0) */
function seedCode(index: number, createdAt: Date) {
  const vn = new Date(createdAt.getTime() + VN_OFFSET);
  const date = [
    vn.getUTCFullYear() % 100,
    vn.getUTCMonth() + 1,
    vn.getUTCDate(),
  ]
    .map((n) => String(n).padStart(2, '0'))
    .join('');
  return `SF-${date}-0${String(index).padStart(3, '0')}`;
}

async function seedAccounts(prisma: PrismaClient, random: Random) {
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  // Cùng một mật khẩu: băm một lần cho nhanh
  const passwordHash = await hash(SEED_PASSWORD, 10);
  const upsert = (data: {
    email: string;
    fullName: string;
    role: Role;
    phone?: string;
  }) =>
    prisma.user.upsert({
      where: { email: data.email },
      // Đã có thì giữ nguyên (không đổi mật khẩu người dùng đã sửa)
      update: {},
      create: { ...data, passwordHash },
    });

  const staff = await Promise.all(STAFF.map(upsert));
  const customers = [];
  for (let i = 1; i <= CUSTOMER_COUNT; i++) {
    const fullName = `${pick(SURNAMES)} ${pick(MIDDLE)} ${pick(GIVEN)}`;
    const phone = `09${String(10_000_000 + i * 7_919).slice(-8)}`;
    customers.push(
      await upsert({
        email: `khach${String(i).padStart(2, '0')}@shopfast.vn`,
        fullName,
        role: Role.CUSTOMER,
        phone,
      }),
    );
  }
  const warehouse = staff.find((u) => u.role === Role.WAREHOUSE)!;
  return { customers, warehouse };
}

export async function seedAccountsAndOrders(
  prisma: PrismaClient,
  random: Random,
) {
  const between = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const scenarioTotal = SCENARIOS.reduce((sum, [, weight]) => sum + weight, 0);
  const pickScenario = () => {
    let roll = random() * scenarioTotal;
    for (const [scenario, weight] of SCENARIOS) {
      if ((roll -= weight) < 0) return scenario;
    }
    return SCENARIOS[0][0];
  };

  const { customers, warehouse } = await seedAccounts(prisma, random);
  const timeoutMs =
    Number(process.env.ORDER_PAYMENT_TIMEOUT_MINUTES ?? 24 * 60) * 60 * 1000;

  // Sản phẩm đang bán còn hàng; giữ số tồn trong bộ nhớ để chọn số lượng hợp lý
  const products = (
    await prisma.product.findMany({
      where: { isActive: true, inventory: { stock: { gt: 0 } } },
      select: {
        id: true,
        name: true,
        price: true,
        inventory: { select: { stock: true } },
      },
      orderBy: { sku: 'asc' },
    })
  ).map((p) => ({ ...p, stock: p.inventory!.stock }));

  let created = 0;
  let skipped = 0;
  for (let index = 1; index <= ORDER_COUNT; index++) {
    const suffix = `-0${String(index).padStart(3, '0')}`;
    const scenario = pickScenario();
    const steps = stepsFor(scenario);
    const customer = pick(customers);
    const now = Date.now();

    // Chờ thanh toán: đặt trong vài giờ gần đây (còn hạn). Hệ thống tự huỷ: đặt quá hạn.
    // Còn lại: rải trong 30 ngày qua, mỗi bước cách nhau 1–20 giờ.
    const createdAt = new Date(
      scenario.kind === 'flow' &&
        scenario.status === OrderStatus.PENDING_PAYMENT
        ? now - between(5, Math.min(300, timeoutMs / 60_000 - 1)) * 60_000
        : scenario.kind === 'cancel' && scenario.by === 'system'
          ? now - timeoutMs - between(1, 72) * HOUR
          : now - between(2, 30) * DAY,
    );
    // Mỗi bước cách bước trước 1–20 giờ nhưng không quá phần thời gian chia đều tới hiện tại,
    // để các mốc luôn tăng dần và nằm trong quá khứ (đơn đặt gần đây vẫn đi đủ bước)
    const room = (now - createdAt.getTime()) / (steps.length + 1);
    let at = createdAt.getTime();
    const timeline = steps.map((step) => {
      at =
        step.by === 'system'
          ? createdAt.getTime() + timeoutMs + between(1, 30) * 60_000
          : at +
            Math.max(
              60_000,
              Math.min(between(1, 20) * HOUR, room) * (0.5 + random() / 2),
            );
      return { ...step, at: new Date(at) };
    });

    if (
      await prisma.order.findFirst({ where: { code: { endsWith: suffix } } })
    ) {
      skipped++;
      continue;
    }

    // 1–4 sản phẩm khác nhau, mỗi loại 1–3 món nhưng không vượt tồn kho hiện có
    const lines = new Map<
      string,
      { product: (typeof products)[number]; quantity: number }
    >();
    const lineCount = between(1, 4);
    for (let tries = 0; lines.size < lineCount && tries < 20; tries++) {
      const product = pick(products);
      if (product.stock <= 0 || lines.has(product.id)) continue;
      lines.set(product.id, {
        product,
        quantity: Math.min(between(1, 3), product.stock),
      });
    }
    if (lines.size === 0) break; // hết hàng để đặt

    const cancelled = scenario.kind === 'cancel';
    const total = [...lines.values()].reduce(
      (sum, { product, quantity }) => sum.add(product.price.mul(quantity)),
      new Prisma.Decimal(0),
    );
    const actor = (by: Step['by']) =>
      by === 'customer' ? customer.id : by === 'staff' ? warehouse.id : null;
    const paidStep = timeline.find((s) => s.toStatus === OrderStatus.PAID);
    const last = timeline.at(-1);

    try {
      await prisma.$transaction(async (tx) => {
        // Đơn đang hiệu lực giữ hàng thật; đơn đã huỷ đã trả kho nên tồn kho không đổi
        if (!cancelled) {
          for (const { product, quantity } of lines.values()) {
            const { count } = await tx.inventory.updateMany({
              where: { productId: product.id, stock: { gte: quantity } },
              data: { stock: { decrement: quantity } },
            });
            if (count === 0) throw new Error('not-enough-stock');
          }
        }
        await tx.order.create({
          data: {
            code: seedCode(index, createdAt),
            userId: customer.id,
            status: last?.toStatus ?? OrderStatus.PENDING_PAYMENT,
            totalAmount: total,
            shippingFee: 0,
            recipientName: customer.fullName,
            recipientPhone: customer.phone ?? '0900000000',
            shippingAddress: pick(ADDRESSES),
            paidAt: paidStep?.at ?? null,
            cancelledAt: cancelled ? (last?.at ?? null) : null,
            createdAt,
            items: {
              create: [...lines.values()].map(({ product, quantity }) => ({
                productId: product.id,
                productName: product.name,
                unitPrice: product.price,
                quantity,
              })),
            },
            statusHistory: {
              create: [
                {
                  fromStatus: null,
                  toStatus: OrderStatus.PENDING_PAYMENT,
                  changedById: customer.id,
                  createdAt,
                },
                ...timeline.map((step, i) => ({
                  fromStatus:
                    i === 0
                      ? OrderStatus.PENDING_PAYMENT
                      : timeline[i - 1].toStatus,
                  toStatus: step.toStatus,
                  changedById: actor(step.by),
                  note: step.note,
                  createdAt: step.at,
                })),
              ],
            },
          },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'not-enough-stock') continue;
      throw err;
    }
    if (!cancelled) {
      for (const { product, quantity } of lines.values())
        product.stock -= quantity;
    }
    created++;
  }

  return {
    customers: customers.length,
    staff: STAFF.map((s) => s.email),
    password: SEED_PASSWORD,
    created,
    skipped,
  };
}
