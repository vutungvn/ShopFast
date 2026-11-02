import type { Content, FunctionDeclaration } from '@google/genai';

export interface AiRequest {
  system: string;
  contents: Content[];
  tools?: FunctionDeclaration[];
  /** Buộc model trả về đúng một trong các giá trị này (phân loại) */
  choices?: readonly string[];
}

/** Lớp gọi model ngôn ngữ; test thay bằng bản trả lời theo kịch bản */
export interface AiModel {
  /** false khi chưa cấu hình khoá: trợ lý không trả lời, nhân viên xử lý ticket */
  readonly enabled: boolean;
  /**
   * Trả về nguyên `content` của model. Khi có lời gọi công cụ, phải gửi lại đúng content này ở vòng
   * sau (Gemini 3 kèm "thought signature" bên trong), không tự dựng lại.
   */
  generate(request: AiRequest): Promise<Content>;
}

export const AI_MODEL = Symbol('AI_MODEL');

/** Ghép các phần chữ trong câu trả lời của model */
export const textOf = (content: Content): string =>
  (content.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();
