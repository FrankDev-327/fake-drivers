import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

// the gateway verifies the JWT and forwards the user id in this header.
// auth-service has no published port, so only the gateway can reach it.
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const userId = request.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') {
    throw new UnauthorizedException('Missing user identity');
  }
  return userId;
});
