// request-context.service.ts
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface Context {
  traceId: string;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<Context>();

  run(traceId: string, callback: () => void) {
    this.asyncLocalStorage.run({ traceId }, callback);
  }

  get traceId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.traceId;
  }
}
