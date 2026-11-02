import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../../common/auth/auth-user';
import {
  STAFF_SUPPORT_ROOM,
  TICKET_UPDATED,
  TicketEventsPublisher,
  TicketUpdatedEvent,
  userRoom,
} from './ticket-events';

const SUPPORT_STAFF: Role[] = [Role.SUPPORT, Role.ADMIN];

/**
 * Hỗ trợ khách realtime. Dùng chung server Socket.IO với OrdersGateway (cùng `path`), nên kết nối
 * đã được xác thực JWT lúc bắt tay ở đó (`socket.data.user`). Khách tự vào room riêng nên chỉ nhận
 * sự kiện ticket của mình; CSKH / admin nhận mọi ticket.
 */
@WebSocketGateway({ path: '/socket.io', serveClient: false })
export class SupportGateway
  implements OnGatewayConnection, TicketEventsPublisher
{
  private readonly logger = new Logger(SupportGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  async handleConnection(socket: Socket) {
    const user = (socket.data as { user?: AuthUser }).user;
    if (!user) return;
    if (user.role === Role.CUSTOMER) await socket.join(userRoom(user.id));
    else if (SUPPORT_STAFF.includes(user.role)) {
      await socket.join(STAFF_SUPPORT_ROOM);
    }
  }

  ticketUpdated(ticketId: string, customerId: string): void {
    const event: TicketUpdatedEvent = { ticketId };
    try {
      this.server
        .to([userRoom(customerId), STAFF_SUPPORT_ROOM])
        .emit(TICKET_UPDATED, event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Không phát được sự kiện ticket ${ticketId}: ${message}`,
      );
    }
  }
}
