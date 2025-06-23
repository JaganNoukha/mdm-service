import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
}

export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<any>> {
    const status = context.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(map((data) => ({ data, status, errors: null })));
  }
}
