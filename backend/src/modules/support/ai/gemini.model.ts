import { ApiError, Content, GoogleGenAI, Type } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env.validation';
import { AiModel, AiRequest } from './ai-model';

/** Khách đang chờ trên màn chat: quá lâu thì trả câu dự phòng */
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 2048;

@Injectable()
export class GeminiModel implements AiModel {
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('GEMINI_API_KEY', { infer: true });
    this.model = config.get('GEMINI_MODEL', { infer: true });
    this.client = apiKey
      ? new GoogleGenAI({
          apiKey,
          // Không thử lại (mặc định 5 lần, chờ tới 60s): hết hạn mức (429) thì báo bận ngay
          httpOptions: {
            timeout: REQUEST_TIMEOUT_MS,
            retryOptions: { attempts: 1 },
          },
        })
      : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async generate({
    system,
    contents,
    tools,
    choices,
  }: AiRequest): Promise<Content> {
    if (!this.client) throw new Error('Chưa cấu hình GEMINI_API_KEY');
    const response = await this.client.models
      .generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: system,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          ...(tools && { tools: [{ functionDeclarations: tools }] }),
          ...(choices && {
            responseMimeType: 'text/x.enum',
            responseSchema: { type: Type.STRING, enum: [...choices] },
          }),
        },
      })
      .catch((error: unknown) => {
        // Gói miễn phí giới hạn số request mỗi phút / mỗi ngày
        if (error instanceof ApiError && error.status === 429) {
          throw new Error('Gemini hết hạn mức (429)');
        }
        throw error;
      });
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts?.length) {
      const reason =
        candidate?.finishReason ?? response.promptFeedback?.blockReason;
      throw new Error(`Model không trả nội dung (${reason ?? 'không rõ'})`);
    }
    return candidate.content;
  }
}
