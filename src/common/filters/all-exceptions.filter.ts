import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import { Response } from 'express';
  import { MongoError } from 'mongodb';
  import { Error as MongooseError } from 'mongoose';
  
  @Catch()
  export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);
  
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
  
      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = 'Internal server error';
      let errorDetails: any = {};
  
      if (exception instanceof HttpException) {
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
  
        if (typeof exceptionResponse === 'string') {
          message = exceptionResponse;
        } else if (typeof exceptionResponse === 'object') {
          message = (exceptionResponse as any).message || message;
          errorDetails = exceptionResponse;
        }
      } else if (exception instanceof MongoError || (exception as any)?.name === 'MongoServerError') {
        // Handle MongoDB specific errors
        const mongoError = exception as MongoError;
        switch (mongoError.code) {
          case 11000: // Duplicate key error
            status = HttpStatus.CONFLICT;
            const field = Object.keys((mongoError as any).keyPattern)[0];
            message = `Duplicate value for field: ${field}`;
            errorDetails = {
              code: 'DUPLICATE_KEY_ERROR',
              field,
              value: (mongoError as any).keyValue[field]
            };
            break;

          case 121: // Document validation failure
            status = HttpStatus.BAD_REQUEST;
            message = 'Document validation failed';
            errorDetails = {
              code: 'VALIDATION_ERROR',
              details: (mongoError as any).errInfo?.details
            };
            break;

          case 13: // Unauthorized
            status = HttpStatus.UNAUTHORIZED;
            message = 'Unauthorized access to database';
            errorDetails = {
              code: 'UNAUTHORIZED'
            };
            break;

          case 18: // Authentication failed
            status = HttpStatus.UNAUTHORIZED;
            message = 'Database authentication failed';
            errorDetails = {
              code: 'AUTHENTICATION_FAILED'
            };
            break;

          case 48: // Namespace exists
            status = HttpStatus.CONFLICT;
            message = 'Collection already exists';
            errorDetails = {
              code: 'NAMESPACE_EXISTS'
            };
            break;

          case 26: // Namespace not found
            status = HttpStatus.NOT_FOUND;
            message = 'Collection not found';
            errorDetails = {
              code: 'NAMESPACE_NOT_FOUND'
            };
            break;

          case 2: // Bad value
            status = HttpStatus.BAD_REQUEST;
            message = 'Invalid value provided';
            errorDetails = {
              code: 'BAD_VALUE'
            };
            break;

          case 9: // Failed to parse
            status = HttpStatus.BAD_REQUEST;
            message = 'Failed to parse query';
            errorDetails = {
              code: 'FAILED_TO_PARSE'
            };
            break;

          case 51: // Cannot create index
            status = HttpStatus.BAD_REQUEST;
            message = 'Failed to create index';
            errorDetails = {
              code: 'INDEX_CREATION_FAILED'
            };
            break;

          case 85: // Operation timeout
            status = HttpStatus.REQUEST_TIMEOUT;
            message = 'Database operation timed out';
            errorDetails = {
              code: 'OPERATION_TIMEOUT'
            };
            break;

          default:
            // For any other MongoDB errors
            message = mongoError.message || 'Database operation failed';
            errorDetails = {
              code: 'MONGO_ERROR',
              mongoCode: mongoError.code
            };
        }
      } else if (exception instanceof MongooseError) {
        // Handle Mongoose specific errors
        if (exception instanceof MongooseError.ValidationError) {
          status = HttpStatus.BAD_REQUEST;
          message = 'Validation failed';
          errorDetails = {
            code: 'VALIDATION_ERROR',
            errors: Object.keys(exception.errors).reduce((acc, key) => {
              acc[key] = exception.errors[key].message;
              return acc;
            }, {})
          };
        } else if (exception instanceof MongooseError.CastError) {
          status = HttpStatus.BAD_REQUEST;
          message = `Invalid ${exception.path}: ${exception.value}`;
          errorDetails = {
            code: 'CAST_ERROR',
            path: exception.path,
            value: exception.value
          };
        } else {
          message = exception.message;
          errorDetails = {
            code: 'MONGOOSE_ERROR',
            name: exception.name
          };
        }
      }
  
      this.logger.error(`[${request.method}] ${request.url} - ${message}`, (exception as any)?.stack);
  
      response.status(status).json({
        statusCode: status,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
        ...errorDetails,
      });
    }
  }
  