import { OrderStatus } from '@prisma/client';
import { customerActions } from './order-rules';

const HOUR = 60 * 60 * 1000;
const createdAt = new Date('2026-10-30T08:00:00Z');

describe('customerActions', () => {
  it('chờ thanh toán, còn hạn => có hạn thanh toán, được trả tiền và huỷ', () => {
    const now = new Date(createdAt.getTime() + HOUR);
    expect(
      customerActions(
        { status: OrderStatus.PENDING_PAYMENT, createdAt },
        24 * HOUR,
        now,
      ),
    ).toEqual({
      paymentDueAt: new Date('2026-10-31T08:00:00Z'),
      canPay: true,
      canCancel: true,
    });
  });

  it('chờ thanh toán nhưng đã quá hạn => không trả tiền được, vẫn huỷ được', () => {
    const now = new Date(createdAt.getTime() + 25 * HOUR);
    expect(
      customerActions(
        { status: OrderStatus.PENDING_PAYMENT, createdAt },
        24 * HOUR,
        now,
      ),
    ).toMatchObject({ canPay: false, canCancel: true });
  });

  it.each([
    [OrderStatus.PAID, true],
    [OrderStatus.CONFIRMED, false],
    [OrderStatus.PACKING, false],
    [OrderStatus.SHIPPING, false],
    [OrderStatus.DELIVERED, false],
    [OrderStatus.CANCELLED, false],
  ])(
    '%s => không có hạn thanh toán, canPay=false, canCancel=%s',
    (status, canCancel) => {
      expect(customerActions({ status, createdAt }, 24 * HOUR)).toEqual({
        paymentDueAt: null,
        canPay: false,
        canCancel,
      });
    },
  );
});
