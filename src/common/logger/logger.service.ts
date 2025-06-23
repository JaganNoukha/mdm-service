import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';
import { RequestContextService } from '../middleware/request.service';

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(private readonly requestContext: RequestContextService) {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info', // 'debug' | 'info' | 'warn' | 'error'
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, stack }) => {
          return stack
            ? `[${timestamp}] ${level.toUpperCase()}: ${message} - ${stack}`
            : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
      ),
      transports: [
        new transports.Console(), // Console logs
        // new transports.File({ filename: 'logs/app.log' }), // All logs
        // new transports.File({ filename: 'logs/error.log', level: 'error' }), // Only errors
      ],
    });
  }

  log(message: string) {
    const traceId = this.requestContext.traceId || 'N/A';
    this.logger.info(`[traceId: ${traceId}]` + message);
  }

  error(message: string, trace?: string) {
    const traceId = this.requestContext.traceId || 'N/A';
    this.logger.error({ message: `[traceId: ${traceId}]` + message, stack: trace });
  }

  warn(message: string) {
    const traceId = this.requestContext.traceId || 'N/A';
    this.logger.warn(`[traceId: ${traceId}]` + message);
  }

  debug(message: string) {
    const traceId = this.requestContext.traceId || 'N/A';
    this.logger.debug(`[traceId: ${traceId}]` + message);
  }
}
