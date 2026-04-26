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

    const identifier = request.user?.id;

    const ratelimit = getRatelimitClient();

    if (!identifier) {
      // LLM endpoints require authentication. Reject unauthenticated requests
      // instead of rate-limiting by IP (which is spoofable via x-forwarded-for).
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
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
