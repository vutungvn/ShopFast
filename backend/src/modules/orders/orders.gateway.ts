import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { isUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { AuthUser, JwtPayload } from '../../common/auth/auth-user';
import {
  ORDER_UPDATED,
  OrderEventsPublisher,
  OrderUpdatedEvent,
  orderRoom,
  STAFF_ORDERS_ROOM,
} from './order-events';
import { OrdersRepository } from './orders.repository';

/** Lỗi bắt tay client nhận trong `connect_error`: refresh token rồi kết nối lại */
export const UNAUTHORIZED = 'UNAUTHORIZED';

/** Mỗi kết nối theo dõi tối đa ngần này đơn cùng lúc */
const MAX_WATCHED_ORDERS = 20;

export type SubscribeAck = { ok: true } | { ok: false; message: string };

interface SocketData {
  user: AuthUser;
}

const userOf = (socket: Socket) => (socket.data as SocketData).user;

/**
 * Theo dõi đơn hàng realtime (F02). Xác thực JWT lúc bắt tay; khách chỉ vào room đơn của mình,
 * nhân viên vào được mọi đơn và tự nhận mọi thay đổi qua room `staff:orders`.
 * Token hết hạn khi đang kết nối thì không ngắt; kết nối lại phải dùng token mới.
 */
@WebSocketGateway({ path: '/socket.io', serveClient: false })
export class OrdersGateway
  implements OnGatewayInit, OnGatewayConnection, OrderEventsPublisher
{
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly orders: OrdersRepository,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      this.authenticate(socket).then(
        (user) => {
          (socket.data as SocketData).user = user;
          next();
        },
        () => next(new Error(UNAUTHORIZED)),
      );
    });
  }

  async handleConnection(socket: Socket) {
    if (userOf(socket).role !== Role.CUSTOMER) {
      await socket.join(STAFF_ORDERS_ROOM);
    }
  }

  @SubscribeMessage('order:subscribe')
  async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<SubscribeAck> {
    const orderId = orderIdOf(body);
    if (!orderId) return { ok: false, message: 'Mã đơn không hợp lệ' };
    const room = orderRoom(orderId);
    if (socket.rooms.has(room)) return { ok: true };
    if (watchedCount(socket) >= MAX_WATCHED_ORDERS) {
      return {
        ok: false,
        message: `Chỉ theo dõi được tối đa ${MAX_WATCHED_ORDERS} đơn cùng lúc`,
      };
    }

    const user = userOf(socket);
    const ownerId = await this.orders.findOwnerId(orderId);
    // Đơn của người khác cũng báo "không tìm thấy" để không lộ đơn đó có tồn tại
    if (!ownerId || (user.role === Role.CUSTOMER && ownerId !== user.id)) {
      return { ok: false, message: 'Không tìm thấy đơn hàng' };
    }
    await socket.join(room);
    return { ok: true };
  }

  @SubscribeMessage('order:unsubscribe')
  async unsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<SubscribeAck> {
    const orderId = orderIdOf(body);
    if (orderId) await socket.leave(orderRoom(orderId));
    return { ok: true };
  }

  orderUpdated(event: OrderUpdatedEvent): void {
    try {
      this.server
        .to([orderRoom(event.orderId), STAFF_ORDERS_ROOM])
        .emit(ORDER_UPDATED, event);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Không phát được sự kiện đơn ${event.code}: ${message}`);
    }
  }

  private async authenticate(socket: Socket): Promise<AuthUser> {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token !== 'string') throw new Error(UNAUTHORIZED);
    const payload = await this.jwt.verifyAsync<JwtPayload>(auth.token, {
      algorithms: ['HS256'],
    });
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}

function orderIdOf(body: unknown): string | null {
  const orderId = (body as { orderId?: unknown } | null)?.orderId;
  return typeof orderId === 'string' && isUUID(orderId) ? orderId : null;
}

/** Số room đơn đang theo dõi (trừ room riêng của socket và room nhân viên) */
function watchedCount(socket: Socket): number {
  const prefix = orderRoom('');
  return [...socket.rooms].filter((room) => room.startsWith(prefix)).length;
}
