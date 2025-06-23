// trace-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContextService } from './request.service';

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    let traceId = req.headers['x-trace-id'] as string;
    if (!traceId) {
      traceId = uuidv4();
    }

    // Store it in AsyncLocalStorage for this request
    this.requestContext.run(traceId, () => {
      res.setHeader('x-trace-id', traceId);
      next();
    });
  }
}
