import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentActionStatus, Role } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { AgentActionsService } from './agent-actions.service';

const reviewer: AuthUser = {
  id: 'cskh-1',
  email: 'cskh@shopfast.vn',
  role: Role.SUPPORT,
};

const action = {
  id: 'action-1',
  ticketId: 'ticket-1',
  type: 'CANCEL_ORDER',
  payload: { orderId: 'order-1', orderCode: 'SF-261101-K7QM' },
  reason: 'Đặt nhầm màu',
  status: AgentActionStatus.PENDING,
  error: null,
  createdAt: new Date(),
  reviewedAt: null,
  ticket: { subject: 'Huỷ đơn', customer: { fullName: 'Khách A' } },
  reviewedBy: null,
};

function setup(claimed = 1, exists = 1) {
  const prisma = {
    agentAction: {
      updateMany: jest.fn().mockResolvedValue({ count: claimed }),
      count: jest.fn().mockResolvedValue(exists),
      findUniqueOrThrow: jest.fn().mockResolvedValue(action),
      update: jest.fn().mockResolvedValue(action),
    },
    ticket: { update: jest.fn().mockResolvedValue({ customerId: 'khach-a' }) },
    order: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const orders = { cancel: jest.fn().mockResolvedValue({}) };
  const events = { ticketUpdated: jest.fn() };
  const service = new AgentActionsService(
    prisma as unknown as PrismaService,
    orders as unknown as OrdersService,
    events,
  );
  return { service, prisma, orders, events };
}

const messageOf = (prisma: ReturnType<typeof setup>['prisma']) =>
  (
    prisma.ticket.update.mock.calls[0][0] as {
      data: { messages: { create: { content: string } } };
    }
  ).data.messages.create.content;

describe('AgentActionsService', () => {
  it('duyệt: chỉ chuyển từ PENDING, huỷ đơn với vai nhân viên rồi EXECUTED', async () => {
    const { service, prisma, orders } = setup();

    await service.approve(reviewer, 'action-1');

    expect(prisma.agentAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'action-1', status: AgentActionStatus.PENDING },
        data: expect.objectContaining({
          status: AgentActionStatus.APPROVED,
          reviewedById: 'cskh-1',
        }),
      }),
    );
    expect(orders.cancel).toHaveBeenCalledWith(reviewer, 'order-1', {
      reason: 'Duyệt đề xuất của trợ lý AI: Đặt nhầm màu',
    });
    expect(prisma.agentAction.update).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: expect.objectContaining({ status: AgentActionStatus.EXECUTED }),
    });
    expect(messageOf(prisma)).toContain('Đơn đã được huỷ');
  });

  it('báo kết quả xong thì phát realtime cho khách chủ ticket + CSKH', async () => {
    const { service, events } = setup();

    await service.reject(reviewer, 'action-1', { reason: 'Đơn đã đóng gói' });

    expect(events.ticketUpdated).toHaveBeenCalledWith('ticket-1', 'khach-a');
  });

  it('duyệt nhưng đơn đã đổi trạng thái: FAILED kèm lý do, báo khách', async () => {
    const { service, prisma, orders } = setup();
    orders.cancel.mockRejectedValue(
      new ConflictException("Không thể huỷ đơn đang ở trạng thái 'Đang giao'"),
    );

    await service.approve(reviewer, 'action-1');

    expect(prisma.agentAction.update).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: {
        status: AgentActionStatus.FAILED,
        error: "Không thể huỷ đơn đang ở trạng thái 'Đang giao'",
      },
    });
    expect(messageOf(prisma)).toContain('Không thể huỷ đơn SF-261101-K7QM');
  });

  it('từ chối: lưu lý do, không đụng tới đơn, báo khách', async () => {
    const { service, prisma, orders } = setup();

    await service.reject(reviewer, 'action-1', { reason: 'Đơn đã đóng gói' });

    expect(prisma.agentAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AgentActionStatus.REJECTED,
          error: 'Đơn đã đóng gói',
        }),
      }),
    );
    expect(orders.cancel).not.toHaveBeenCalled();
    expect(messageOf(prisma)).toContain('không được chấp nhận');
  });

  it('đề xuất đã có người xử lý: 409, không huỷ đơn', async () => {
    const { service, orders, events } = setup(0, 1);

    await expect(service.approve(reviewer, 'action-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(orders.cancel).not.toHaveBeenCalled();
    expect(events.ticketUpdated).not.toHaveBeenCalled();
  });

  it('đề xuất không tồn tại: 404', async () => {
    const { service } = setup(0, 0);

    await expect(
      service.reject(reviewer, 'missing', { reason: 'Không hợp lệ' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
