import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { getRatelimitClient } from '../lib/redis';
import type { Request } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id: string } }>();

    // Better Auth usually sets the session context, but as a fallback
    // we also extract the authorization token header to rate limit per token
    // if the user object isn't strictly populated in this execution phase
    const authHeader = request.headers.authorization;
    const identifier =
      request.user?.id ||
      (authHeader ? authHeader.replace('Bearer ', '') : null);

    const ratelimit = getRatelimitClient();

    if (!identifier) {
      const ip =
        (request.headers['x-forwarded-for'] as string) ||
        request.socket.remoteAddress ||
        'anonymous';
      const { success } = await ratelimit.limit(`ratelimit_${ip}`);
      if (!success) {
        throw new HttpException(
          'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    }

    const { success } = await ratelimit.limit(`ratelimit_${identifier}`);
    if (!success) {
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
