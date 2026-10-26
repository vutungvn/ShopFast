import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(user?: { role: Role }): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('cho qua khi endpoint không yêu cầu vai trò', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser({ role: Role.CUSTOMER }))).toBe(
      true,
    );
  });

  it.each([Role.CUSTOMER, Role.SUPPORT, Role.WAREHOUSE])(
    '%s bị chặn ở endpoint chỉ dành cho ADMIN',
    (role) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      expect(() => guard.canActivate(contextWithUser({ role }))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('cho qua khi vai trò nằm trong danh sách cho phép', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.WAREHOUSE, Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: Role.WAREHOUSE }))).toBe(
      true,
    );
  });
});
