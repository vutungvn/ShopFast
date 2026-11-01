import { Request } from 'express';

/** Access token trong header `Authorization: Bearer <token>` */
export function bearerToken(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' && token ? token : undefined;
}
