import { applyDecorators } from '@nestjs/common';
import { Matches, MaxLength } from 'class-validator';

export const MAX_IMAGE_URL = 500;

/**
 * Ảnh sản phẩm: đường dẫn ảnh tĩnh do web phục vụ (`/images/...`) hoặc URL `https://`.
 * Không nhận http (trang HTTPS sẽ chặn ảnh), `javascript:`, `data:` hay đường dẫn có `..`.
 */
export const IMAGE_URL_PATTERN =
  /^(?!.*\.\.)(?:\/images\/[A-Za-z0-9][A-Za-z0-9._/-]*|https:\/\/[^\s"'<>\\]+)$/;

export function IsImageUrl() {
  return applyDecorators(
    Matches(IMAGE_URL_PATTERN, {
      message: 'imageUrl phải là đường dẫn /images/... hoặc URL https://',
    }),
    MaxLength(MAX_IMAGE_URL, {
      message: `imageUrl tối đa ${MAX_IMAGE_URL} ký tự`,
    }),
  );
}
