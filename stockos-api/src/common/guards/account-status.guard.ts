import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../types/jwt-payload.type';

const ALLOWED_PATH_REGEXES: RegExp[] = [
  /^\/api\/v1\/auth\/me$/,
  /^\/api\/v1\/auth\/sync$/,
  /^\/api\/v1\/auth\/logout$/,
];

@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload; path?: string; url?: string }>();
    const user = request.user;
    if (!user) {
      return true;
    }

    if (user.accountStatus === 'ACTIVE') {
      return true;
    }

    const path =
      request.path ??
      (request.url ? new URL(request.url, 'http://localhost').pathname : '');

    const allowed = ALLOWED_PATH_REGEXES.some((re) => re.test(path));
    if (allowed) {
      return true;
    }

    throw new ForbiddenException({
      code: 'AUTH_002',
      message: `Account is ${user.accountStatus.toLowerCase()}.`,
      status: user.accountStatus,
    });
  }
}
