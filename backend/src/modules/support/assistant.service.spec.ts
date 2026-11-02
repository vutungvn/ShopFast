import type { Content } from '@google/genai';
import { MessageSender, TicketCategory } from '@prisma/client';
import { AiModel, AiRequest } from './ai/ai-model';
import {
  AssistantService,
  BUSY_REPLY,
  HistoryMessage,
  NOT_READY_REPLY,
  UNVERIFIED_REPLY,
} from './assistant.service';
import { SupportTools } from './support-tools';

const text = (value: string): Content => ({
  role: 'model',
  parts: [{ text: value }],
});
const call = (name: string, args: Record<string, unknown> = {}): Content => ({
  role: 'model',
  parts: [{ functionCall: { id: `call-${name}`, name, args } }],
});

/** Model giả trả lời lần lượt theo kịch bản; phần tử là Error thì ném lỗi */
function scriptedModel(script: (Content | Error)[], enabled = true) {
  const requests: AiRequest[] = [];
  const model: AiModel = {
    enabled,
    generate: jest.fn((request: AiRequest) => {
      // Chụp lại lúc gọi: service còn thêm tiếp vào mảng contents sau đó
      requests.push({ ...request, contents: [...request.contents] });
      const next = script.shift();
      if (!next) return Promise.reject(new Error('hết kịch bản'));
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    }),
  };
  return { model, requests };
}

function fakeTools(result: Record<string, unknown> = { found: false }) {
  const run = jest.fn().mockResolvedValue(result);
  return { tools: { run } as unknown as SupportTools, run };
}

const ticket = { id: 't-1', customerId: 'customer-a', orderCode: null };
const ask = (content: string): HistoryMessage[] => [
  { senderType: MessageSender.CUSTOMER, content },
];

describe('AssistantService', () => {
  describe('reply', () => {
    it('chưa cấu hình khoá: trả câu "chưa sẵn sàng", không gọi model', async () => {
      const { model } = scriptedModel([], false);
      const service = new AssistantService(model, fakeTools().tools);

      const reply = await service.reply(ticket, ask('Đơn của tôi đâu?'));

      expect(reply).toEqual({ content: NOT_READY_REPLY, fallback: true });
      expect(model.generate).not.toHaveBeenCalled();
    });

    it('gọi công cụ với phạm vi lấy từ ticket (không từ tham số model), rồi trả lời', async () => {
      const { model, requests } = scriptedModel([
        call('get_order_status', {
          orderCode: 'SF-261101-K7QM',
          customerId: 'customer-b',
        }),
        text('Đơn SF-261101-K7QM đang được giao ạ.'),
      ]);
      const { tools, run } = fakeTools({
        found: true,
        code: 'SF-261101-K7QM',
        statusLabel: 'Đang giao',
      });
      const service = new AssistantService(model, tools);

      const reply = await service.reply(
        ticket,
        ask('Đơn SF-261101-K7QM tới đâu rồi?'),
      );

      expect(reply).toEqual({
        content: 'Đơn SF-261101-K7QM đang được giao ạ.',
        fallback: false,
      });
      expect(run).toHaveBeenCalledWith(
        'get_order_status',
        expect.objectContaining({ orderCode: 'SF-261101-K7QM' }),
        { ticketId: 't-1', customerId: 'customer-a' },
      );
      // Vòng 2 gửi lại nguyên content có lời gọi công cụ + kết quả công cụ
      const second = requests[1].contents;
      expect(second.at(-2)?.parts?.[0].functionCall?.name).toBe(
        'get_order_status',
      );
      expect(second.at(-1)?.parts?.[0].functionResponse?.response).toEqual({
        result: expect.objectContaining({ found: true }),
      });
    });

    it('chặn câu trả lời nhắc mã đơn chưa từng xuất hiện (bịa)', async () => {
      const { model } = scriptedModel([
        text('Đơn gần nhất của anh là SF-261030-ZZZZ, đang giao ạ.'),
      ]);
      const service = new AssistantService(model, fakeTools().tools);

      const reply = await service.reply(ticket, ask('Đơn gần nhất của tôi?'));

      expect(reply).toEqual({ content: UNVERIFIED_REPLY, fallback: true });
    });

    it('mã đơn khách đã nêu thì được nhắc lại (vd báo không tìm thấy)', async () => {
      const { model } = scriptedModel([
        call('get_order_status', { orderCode: 'SF-261101-AAAA' }),
        text(
          'Em không tìm thấy đơn SF-261101-AAAA trong tài khoản của anh/chị.',
        ),
      ]);
      const service = new AssistantService(model, fakeTools().tools);

      const reply = await service.reply(
        ticket,
        ask('Kiểm tra giúp đơn sf-261101-aaaa'),
      );

      expect(reply.fallback).toBe(false);
    });

    it('mã đơn của ticket (mở từ trang đơn) được phép nhắc tới', async () => {
      const { model } = scriptedModel([text('Đơn SF-261101-BBBB đã giao ạ.')]);
      const service = new AssistantService(model, fakeTools().tools);

      const reply = await service.reply(
        { ...ticket, orderCode: 'SF-261101-BBBB' },
        ask('Đơn này sao rồi?'),
      );

      expect(reply.fallback).toBe(false);
    });

    it('model lỗi (vd 429 hết hạn mức): trả câu "đang bận", không ném lỗi', async () => {
      const { model } = scriptedModel([new Error('429 RESOURCE_EXHAUSTED')]);
      const service = new AssistantService(model, fakeTools().tools);

      const reply = await service.reply(ticket, ask('Xin chào'));

      expect(reply).toEqual({ content: BUSY_REPLY, fallback: true });
    });

    it('gọi công cụ quá 5 vòng: dừng và trả câu "đang bận"', async () => {
      const { model } = scriptedModel(
        Array.from({ length: 6 }, () => call('list_my_recent_orders')),
      );
      const service = new AssistantService(model, fakeTools().tools);

      const reply = await service.reply(ticket, ask('Đơn của tôi'));

      expect(reply).toEqual({ content: BUSY_REPLY, fallback: true });
      expect(model.generate).toHaveBeenCalledTimes(5);
    });

    it('gộp tin liền nhau cùng phía và bỏ tin model đứng đầu', async () => {
      const { model, requests } = scriptedModel([text('Dạ.')]);
      const service = new AssistantService(model, fakeTools().tools);

      await service.reply(ticket, [
        { senderType: MessageSender.AI, content: 'Chào anh/chị' },
        { senderType: MessageSender.CUSTOMER, content: 'A' },
        { senderType: MessageSender.CUSTOMER, content: 'B' },
        { senderType: MessageSender.STAFF, content: 'Em đây' },
        { senderType: MessageSender.CUSTOMER, content: 'C' },
      ]);

      expect(requests[0].contents).toEqual([
        { role: 'user', parts: [{ text: 'A' }, { text: 'B' }] },
        { role: 'model', parts: [{ text: '[Nhân viên CSKH] Em đây' }] },
        { role: 'user', parts: [{ text: 'C' }] },
      ]);
    });
  });

  describe('classify', () => {
    it('trả nhóm model chọn', async () => {
      const { model, requests } = scriptedModel([text('SHIPPING')]);
      const service = new AssistantService(model, fakeTools().tools);

      await expect(service.classify('Bao giờ giao?')).resolves.toBe(
        TicketCategory.SHIPPING,
      );
      expect(requests[0].choices).toContain('ORDER_STATUS');
    });

    it.each([
      ['giá trị lạ', [text('KHAC')]],
      ['model lỗi', [new Error('timeout')]],
    ])('%s: về OTHER', async (_case, script) => {
      const { model } = scriptedModel(script);
      const service = new AssistantService(model, fakeTools().tools);

      await expect(service.classify('...')).resolves.toBe(TicketCategory.OTHER);
    });
  });
});
