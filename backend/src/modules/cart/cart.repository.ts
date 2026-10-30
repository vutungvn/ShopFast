import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { productInclude } from '../products/products.repository';
import { CartLine } from './cart-view';

export interface ProductForCart {
  id: string;
  isActive: boolean;
  stock: number;
}

/** Các thao tác trên giỏ của MỘT user, chạy trong transaction đang giữ khoá giỏ đó. */
export interface LockedCart {
  findProduct(productId: string): Promise<ProductForCart | null>;
  /** null nếu sản phẩm chưa có trong giỏ */
  findQuantity(productId: string): Promise<number | null>;
  countItems(): Promise<number>;
  /** Tạo dòng mới hoặc đặt lại số lượng */
  setQuantity(productId: string, quantity: number): Promise<void>;
}

/** Một dòng trong giỏ kèm thông tin sản phẩm cần cho bước đặt đơn */
export interface CheckoutLine {
  productId: string;
  productName: string;
  price: Prisma.Decimal;
  isActive: boolean;
  quantity: number;
}

/** Giỏ đã khoá trong transaction đặt đơn */
export interface CheckoutCart {
  /** Sắp theo productId: bước trừ kho khoá các dòng tồn kho theo cùng một thứ tự để không deadlock */
  lines(): Promise<CheckoutLine[]>;
  clear(): Promise<void>;
}

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Chỉ đọc: user chưa có giỏ thì trả mảng rỗng, không tạo giỏ. */
  findLines(userId: string): Promise<CartLine[]> {
    return this.prisma.cartItem.findMany({
      where: { cart: { userId } },
      select: { quantity: true, product: { include: productInclude } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  /**
   * Chạy `work` trong transaction sau khi khoá dòng giỏ của user.
   * Các thao tác ghi trên CÙNG một giỏ vì vậy chạy lần lượt: đọc số lượng hiện tại rồi ghi
   * không bị request song song chen giữa (mất lần cộng dồn, vượt tồn kho, vượt 50 loại).
   * Giỏ của user khác không bị ảnh hưởng. Chưa có giỏ thì tạo (upsert theo userId UNIQUE).
   */
  withLockedCart<T>(
    userId: string,
    work: (cart: LockedCart) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // Một câu lệnh nguyên tử vừa tạo giỏ (nếu chưa có) vừa khoá dòng giỏ tới hết transaction.
        // Không dùng tx.cart.upsert(): Prisma chạy nó thành SELECT rồi INSERT, hai request đầu tiên
        // cùng lúc sẽ cùng INSERT và một bên lỗi trùng userId.
        const [{ id: cartId }] = await tx.$queryRaw<[{ id: string }]>`
          INSERT INTO carts (id, "userId", "updatedAt")
          VALUES (gen_random_uuid(), ${userId}::uuid, now())
          ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = now()
          RETURNING id`;
        return work(lockedCart(tx, cartId));
      },
      // Các thao tác trên cùng một giỏ xếp hàng chờ khoá: cho chờ lâu hơn mặc định (2s/5s)
      { maxWait: 10_000, timeout: 15_000 },
    );
  }

  /**
   * Dùng trong transaction đặt đơn: khoá dòng giỏ của user (cùng khoá với withLockedCart) nên đặt đơn
   * và sửa giỏ chạy lần lượt; hai lần bấm đặt đơn cũng vậy, lần sau thấy giỏ đã trống.
   * User chưa có giỏ thì trả giỏ rỗng, không tạo giỏ.
   */
  async lockForCheckout(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<CheckoutCart> {
    const [locked] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM carts WHERE "userId" = ${userId}::uuid FOR UPDATE`;
    if (!locked) return { lines: async () => [], clear: async () => {} };

    const cartId = locked.id;
    return {
      async lines() {
        const items = await tx.cartItem.findMany({
          where: { cartId },
          select: {
            quantity: true,
            product: {
              select: { id: true, name: true, price: true, isActive: true },
            },
          },
          orderBy: { productId: 'asc' },
        });
        return items.map(({ quantity, product }) => ({
          productId: product.id,
          productName: product.name,
          price: product.price,
          isActive: product.isActive,
          quantity,
        }));
      },
      async clear() {
        await tx.cartItem.deleteMany({ where: { cartId } });
      },
    };
  }

  /** Trả về số dòng đã xoá (0 nếu sản phẩm không có trong giỏ). Không tạo giỏ. */
  async removeItem(userId: string, productId: string): Promise<number> {
    const { count } = await this.prisma.cartItem.deleteMany({
      where: { productId, cart: { userId } },
    });
    return count;
  }

  async clear(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  }
}

function lockedCart(tx: Prisma.TransactionClient, cartId: string): LockedCart {
  const key = (productId: string) => ({
    cartId_productId: { cartId, productId },
  });
  return {
    async findProduct(productId) {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          isActive: true,
          inventory: { select: { stock: true } },
        },
      });
      return product
        ? {
            id: product.id,
            isActive: product.isActive,
            stock: product.inventory?.stock ?? 0,
          }
        : null;
    },
    async findQuantity(productId) {
      const item = await tx.cartItem.findUnique({
        where: key(productId),
        select: { quantity: true },
      });
      return item?.quantity ?? null;
    },
    countItems: () => tx.cartItem.count({ where: { cartId } }),
    async setQuantity(productId, quantity) {
      await tx.cartItem.upsert({
        where: key(productId),
        create: { cartId, productId, quantity },
        update: { quantity },
      });
    },
  };
}
