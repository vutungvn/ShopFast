import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AgentActionsController } from './agent-actions.controller';
import { AgentActionsService } from './agent-actions.service';
import { AI_MODEL } from './ai/ai-model';
import { GeminiModel } from './ai/gemini.model';
import { AssistantService } from './assistant.service';
import { SupportGateway } from './support.gateway';
import { SupportTools } from './support-tools';
import { TICKET_EVENTS } from './ticket-events';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

/** Hỗ trợ khách hàng: ticket, trợ lý AI (F01), duyệt đề xuất của AI */
@Module({
  imports: [OrdersModule],
  controllers: [TicketsController, AgentActionsController],
  providers: [
    TicketsService,
    AgentActionsService,
    AssistantService,
    SupportTools,
    { provide: AI_MODEL, useClass: GeminiModel },
    SupportGateway,
    { provide: TICKET_EVENTS, useExisting: SupportGateway },
  ],
})
export class SupportModule {}
