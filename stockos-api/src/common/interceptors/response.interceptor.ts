import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map, mergeMap, of } from 'rxjs';
import { ApiResponse, PaginationMeta } from '../types/api-response.type';

interface ResponseWithMeta<T> {
  data: T;
  meta: PaginationMeta;
}

function hasMetaProperty<T>(
  value: unknown,
): value is ResponseWithMeta<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'meta' in value &&
    'data' in value
  );
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | StreamableFile>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | StreamableFile> {
    return next.handle().pipe(
      mergeMap((response) => {
        if (response instanceof StreamableFile) {
          return of(response);
        }
        if (hasMetaProperty<T>(response)) {
          return of({
            success: true,
            data: response.data,
            meta: response.meta,
            timestamp: new Date().toISOString(),
          });
        }

        return of({
          success: true,
          data: response,
          timestamp: new Date().toISOString(),
        });
      }),
    );
  }
}
