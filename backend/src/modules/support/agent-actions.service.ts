import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AgentActionStatus, MessageSender, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import {
  AgentActionDto,
  AgentActionQueryDto,
  RejectActionDto,
} from './dto/agent-action.dto';
import { cancelPayloadOf } from './support-tools';
import { TICKET_EVENTS, TicketEventsPublisher } from './ticket-events';

const ACTION_INCLUDE = {
  ticket: {
    select: { subject: true, customer: { select: { fullName: true } } },
  },
  reviewedBy: { select: { fullName: true } },
} satisfies Prisma.AgentActionInclude;

type ActionRow = Prisma.AgentActionGetPayload<{
  include: typeof ACTION_INCLUDE;
}>;

/** Đề xuất ghi dữ liệu của trợ lý AI: chỉ chạy khi nhân viên CSKH / admin duyệt */
@Injectable()
export class AgentActionsService {
  private readonly logger = new Logger(AgentActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Inject(TICKET_EVENTS) private readonly events: TicketEventsPublisher,
  ) {}

  async list(
    query: AgentActionQueryDto,
  ): Promise<PaginatedResult<AgentActionDto>> {
    const where: Prisma.AgentActionWhereInput = { status: query.status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.agentAction.findMany({
        where,
        include: ACTION_INCLUDE,
        // Chờ duyệt: cũ nhất trước như hàng đợi; đã xử lý: mới nhất trước
        orderBy: {
          createdAt:
            query.status === AgentActionStatus.PENDING ? 'asc' : 'desc',
        },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.agentAction.count({ where }),
    ]);
    return paginate(await this.toDtos(rows), total, query);
  }

  /**
   * Duyệt và thực thi. Chuyển PENDING → APPROVED có điều kiện nên hai người cùng bấm thì người sau
   * nhận 409. Đơn đã đổi trạng thái không huỷ được nữa => FAILED kèm lý do.
   */
  async approve(reviewer: AuthUser, id: string): Promise<AgentActionDto> {
    await this.claim(id, reviewer, AgentActionStatus.APPROVED);
    const action = await this.prisma.agentAction.findUniqueOrThrow({
      where: { id },
    });
    const { orderId, orderCode } = cancelPayloadOf(action.payload);
    try {
      await this.orders.cancel(reviewer, orderId, {
        reason:
          `Duyệt đề xuất của trợ lý AI: ${action.reason ?? 'khách yêu cầu huỷ'}`.slice(
            0,
            500,
          ),
      });
      await this.finish(id, {
        status: AgentActionStatus.EXECUTED,
        executedAt: new Date(),
      });
      await this.notifyCustomer(
        action.ticketId,
        reviewer,
        `Nhân viên đã duyệt yêu cầu huỷ đơn ${orderCode}. Đơn đã được huỷ.`,
      );
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      const reason = error.message;
      this.logger.warn(`Không thực thi được đề xuất ${id}: ${reason}`);
      await this.finish(id, {
        status: AgentActionStatus.FAILED,
        error: reason,
      });
      await this.notifyCustomer(
        action.ticketId,
        reviewer,
        `Không thể huỷ đơn ${orderCode}: ${reason}.`,
      );
    }
    return this.get(id);
  }

  async reject(
    reviewer: AuthUser,
    id: string,
    dto: RejectActionDto,
  ): Promise<AgentActionDto> {
    await this.claim(id, reviewer, AgentActionStatus.REJECTED, dto.reason);
    const action = await this.prisma.agentAction.findUniqueOrThrow({
      where: { id },
    });
    await this.notifyCustomer(
      action.ticketId,
      reviewer,
      `Yêu cầu huỷ đơn ${cancelPayloadOf(action.payload).orderCode} không được chấp nhận: ${dto.reason}`,
    );
    return this.get(id);
  }

  /** Chỉ một người xử lý được mỗi đề xuất */
  private async claim(
    id: string,
    reviewer: AuthUser,
    status: AgentActionStatus,
    note?: string,
  ): Promise<void> {
    const { count } = await this.prisma.agentAction.updateMany({
      where: { id, status: AgentActionStatus.PENDING },
      data: {
        status,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        error: note,
      },
    });
    if (count) return;
    const exists = await this.prisma.agentAction.count({ where: { id } });
    if (!exists) throw new NotFoundException('Không tìm thấy đề xuất');
    throw new ConflictException('Đề xuất đã được xử lý');
  }

  private finish(id: string, data: Prisma.AgentActionUpdateInput) {
    return this.prisma.agentAction.update({ where: { id }, data });
  }

  /** Báo kết quả vào ticket để khách biết, rồi phát realtime cho khách + CSKH */
  private async notifyCustomer(
    ticketId: string,
    reviewer: AuthUser,
    content: string,
  ) {
    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        messages: {
          create: {
            senderType: MessageSender.STAFF,
            senderId: reviewer.id,
            content,
          },
        },
      },
    });
    this.events.ticketUpdated(ticketId, ticket.customerId);
  }

  private async get(id: string): Promise<AgentActionDto> {
    const row = await this.prisma.agentAction.findUniqueOrThrow({
      where: { id },
      include: ACTION_INCLUDE,
    });
    const [dto] = await this.toDtos([row]);
    return dto;
  }

  private async toDtos(rows: ActionRow[]): Promise<AgentActionDto[]> {
    const payloads = rows.map((row) => cancelPayloadOf(row.payload));
    const orders = await this.prisma.order.findMany({
      where: {
        id: { in: payloads.map((payload) => payload.orderId).filter(Boolean) },
      },
      select: { id: true, status: true },
    });
    const statusOf = new Map(orders.map((order) => [order.id, order.status]));
    return rows.map((row, index) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      reason: row.reason,
      note: row.error,
      orderId: payloads[index].orderId,
      orderCode: payloads[index].orderCode,
      orderStatus: statusOf.get(payloads[index].orderId) ?? null,
      ticketId: row.ticketId,
      ticketSubject: row.ticket.subject,
      customerName: row.ticket.customer.fullName,
      reviewerName: row.reviewedBy?.fullName ?? null,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
    }));
  }
}
