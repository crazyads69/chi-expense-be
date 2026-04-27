import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { TimeoutError } from 'rxjs';

const LLM_TIMEOUT_MS = 25000;
const CRUD_TIMEOUT_MS = 10000;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const url = request.url || '';

    const isLLM =
      url.includes('/input/text') || url.includes('/input/image');
    const timeoutMs = isLLM ? LLM_TIMEOUT_MS : CRUD_TIMEOUT_MS;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new HttpException(
                'Request timeout — please retry',
                HttpStatus.REQUEST_TIMEOUT,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
