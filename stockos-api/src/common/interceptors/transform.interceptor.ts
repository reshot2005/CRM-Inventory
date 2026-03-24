import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { Observable, map } from 'rxjs';

export const RESPONSE_DTO_KEY = 'response_dto';

export const ResponseDto = <T>(dto: ClassConstructor<T>) =>
  SetMetadata(RESPONSE_DTO_KEY, dto);

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const dto = this.reflector.get<ClassConstructor<unknown> | undefined>(
      RESPONSE_DTO_KEY,
      context.getHandler(),
    );

    if (!dto) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (Array.isArray(data)) {
          return plainToInstance(dto, data, {
            excludeExtraneousValues: true,
          });
        }

        return plainToInstance(dto, data, {
          excludeExtraneousValues: true,
        });
      }),
    );
  }
}
