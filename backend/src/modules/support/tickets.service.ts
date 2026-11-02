import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentActionStatus,
  MessageSender,
  Prisma,
  Role,
  TicketStatus,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/auth-user';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AssistantService } from './assistant.service';
import {
  CreateTicketDto,
  TicketMessageDto,
  TicketQueryDto,
  UpdateTicketDto,
} from './dto/ticket-request.dto';
import { TicketDetailDto, TicketSummaryDto } from './dto/ticket-response.dto';
import { cancelPayloadOf } from './support-tools';
import { TICKET_EVENTS, TicketEventsPublisher } from './ticket-events';

/** Số tin gần nhất gửi cho trợ lý AI */
const HISTORY_FOR_AI = 20;
const CLOSED: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
const HAND_BACK_MESSAGE =
  'Nhân viên đã chuyển cuộc trò chuyện lại cho trợ lý AI. Anh/chị cứ nhắn tiếp, trợ lý sẽ trả lời ngay ạ.';

const SUMMARY_INCLUDE = {
  order: { select: { code: true } },
  customer: { select: { fullName: true } },
  _count: {
    select: { agentActions: { where: { status: AgentActionStatus.PENDING } } },
  },
} satisfies Prisma.TicketInclude;

const DETAIL_INCLUDE = {
  ...SUMMARY_INCLUDE,
  messages: {
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { fullName: true } } },
  },
  agentActions: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TicketInclude;

type TicketSummaryRow = Prisma.TicketGetPayload<{
  include: typeof SUMMARY_INCLUDE;
}>;
type TicketDetailRow = Prisma.TicketGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

const isCustomer = (user: AuthUser) => user.role === Role.CUSTOMER;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assistant: AssistantService,
    @Inject(TICKET_EVENTS) private readonly events: TicketEventsPublisher,
  ) {}

  /** Khách tạo yêu cầu: lưu tin đầu, AI phân loại và trả lời ngay */
  async create(
    customer: AuthUser,
    dto: CreateTicketDto,
  ): Promise<TicketDetailDto> {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, userId: customer.id },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    const ticket = await this.prisma.ticket.create({
      data: {
        customerId: customer.id,
        orderId: dto.orderId,
        subject: dto.subject,
        messages: {
          create: {
            senderType: MessageSender.CUSTOMER,
            senderId: customer.id,
            content: dto.message,
          },
        },
      },
    });
    const [category] = await Promise.all([
      this.assistant.classify(`${dto.subject}\n${dto.message}`),
      this.answerWithAssistant(ticket.id),
    ]);
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { category },
    });
    this.events.ticketUpdated(ticket.id, customer.id);
    return this.detail(customer, ticket.id);
  }

  /** Khách: yêu cầu của mình. Nhân viên: tất cả, lọc theo trạng thái / nhóm */
  async list(
    user: AuthUser,
    query: TicketQueryDto,
  ): Promise<PaginatedResult<TicketSummaryDto>> {
    const where: Prisma.TicketWhereInput = {
      ...(isCustomer(user) && { customerId: user.id }),
      status: query.open ? { notIn: CLOSED } : query.status,
      category: query.category,
      orderId: query.orderId,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return paginate(
      rows.map((row) => this.toSummary(row, user)),
      total,
      query,
    );
  }

  /** Khách chỉ xem yêu cầu của mình (của người khác => 404) */
  async detail(user: AuthUser, id: string): Promise<TicketDetailDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, ...(isCustomer(user) && { customerId: user.id }) },
      include: DETAIL_INCLUDE,
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ');
    return this.toDetail(ticket, user);
  }

  /**
   * Gửi tin. Khách: AI trả lời nếu chưa có nhân viên tiếp nhận.
   * Nhân viên: tiếp nhận ticket (gán người xử lý, chuyển IN_PROGRESS), AI thôi trả lời.
   */
  async addMessage(
    user: AuthUser,
    id: string,
    dto: TicketMessageDto,
  ): Promise<TicketDetailDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, ...(isCustomer(user) && { customerId: user.id }) },
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ');
    if (CLOSED.includes(ticket.status)) {
      throw new ConflictException('Yêu cầu hỗ trợ đã đóng');
    }
    const staff = !isCustomer(user);
    await this.prisma.ticket.update({
      where: { id },
      data: {
        // Đổi updatedAt để ticket có tin mới nổi lên đầu danh sách
        updatedAt: new Date(),
        ...(staff && {
          assigneeId: ticket.assigneeId ?? user.id,
          status:
            ticket.status === TicketStatus.OPEN
              ? TicketStatus.IN_PROGRESS
              : ticket.status,
        }),
        messages: {
          create: {
            senderType: staff ? MessageSender.STAFF : MessageSender.CUSTOMER,
            senderId: user.id,
            content: dto.content,
          },
        },
      },
    });
    // Báo ngay tin vừa gửi (nhân viên thấy tin khách trong lúc AI còn đang trả lời), rồi báo câu trả lời
    this.events.ticketUpdated(id, ticket.customerId);
    if (!staff && this.aiActive(ticket)) {
      await this.answerWithAssistant(id);
      this.events.ticketUpdated(id, ticket.customerId);
    }
    return this.detail(user, id);
  }

  /** Nhân viên đổi trạng thái / sửa nhóm do AI phân loại */
  async update(
    staff: AuthUser,
    id: string,
    dto: UpdateTicketDto,
  ): Promise<TicketDetailDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { customerId: true },
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ');
    await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status, category: dto.category },
    });
    this.events.ticketUpdated(id, ticket.customerId);
    return this.detail(staff, id);
  }

  /**
   * Nhân viên trả cuộc trò chuyện lại cho trợ lý AI: bỏ người xử lý, về OPEN, AI trả lời từ tin sau
   * của khách. Báo vào hội thoại để khách biết
   */
  async handBack(staff: AuthUser, id: string): Promise<TicketDetailDto> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ');
    if (!this.assistant.enabled) {
      throw new ConflictException('Trợ lý AI chưa được cấu hình');
    }
    if (CLOSED.includes(ticket.status)) {
      throw new ConflictException('Yêu cầu hỗ trợ đã đóng');
    }
    if (this.aiActive(ticket)) {
      throw new ConflictException('Trợ lý AI đang trả lời yêu cầu này');
    }
    await this.prisma.ticket.update({
      where: { id },
      data: {
        assigneeId: null,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            senderType: MessageSender.STAFF,
            senderId: staff.id,
            content: HAND_BACK_MESSAGE,
          },
        },
      },
    });
    this.events.ticketUpdated(id, ticket.customerId);
    return this.detail(staff, id);
  }

  /** AI chỉ tự trả lời khi ticket còn mở và chưa nhân viên nào tiếp nhận */
  private aiActive(ticket: {
    status: TicketStatus;
    assigneeId: string | null;
  }) {
    return (
      this.assistant.enabled &&
      ticket.status === TicketStatus.OPEN &&
      !ticket.assigneeId
    );
  }

  private async answerWithAssistant(ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: {
        order: { select: { code: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: HISTORY_FOR_AI,
          select: { senderType: true, content: true },
        },
      },
    });
    const reply = await this.assistant.reply(
      {
        id: ticket.id,
        customerId: ticket.customerId,
        orderCode: ticket.order?.code ?? null,
      },
      ticket.messages.reverse(),
    );
    await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderType: MessageSender.AI,
        content: reply.content,
      },
    });
  }

  private toSummary(row: TicketSummaryRow, user: AuthUser): TicketSummaryDto {
    return {
      id: row.id,
      subject: row.subject,
      category: row.category,
      status: row.status,
      orderCode: row.order?.code ?? null,
      ...(!isCustomer(user) && { customerName: row.customer.fullName }),
      pendingActions: row._count.agentActions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toDetail(row: TicketDetailRow, user: AuthUser): TicketDetailDto {
    return {
      ...this.toSummary(row, user),
      orderId: row.orderId,
      aiActive: this.aiActive(row),
      messages: row.messages.map((message) => ({
        id: message.id,
        senderType: message.senderType,
        senderName: message.sender?.fullName ?? null,
        content: message.content,
        createdAt: message.createdAt,
      })),
      actions: row.agentActions.map((action) => ({
        id: action.id,
        type: action.type,
        orderCode: cancelPayloadOf(action.payload).orderCode,
        status: action.status,
        reason: action.reason,
        note: action.error,
        createdAt: action.createdAt,
      })),
    };
  }
}
