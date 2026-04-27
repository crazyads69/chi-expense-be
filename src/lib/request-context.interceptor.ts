import { randomUUID } from 'crypto';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { requestContext } from './request-context';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Use incoming x-request-id or generate new one
    const requestId = request.headers['x-request-id'] || randomUUID();
    const startTime = Date.now();

    // Set response header
    const response = context.switchToHttp().getResponse();
    response.setHeader('x-request-id', requestId);

    // Set Sentry tag
    Sentry.setTag('request_id', requestId);

    return new Observable((subscriber) => {
      const subscription = requestContext.run({ requestId, startTime }, () => {
        return next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
      return () => subscription.unsubscribe();
    });
  }
}
