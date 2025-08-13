import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseApiException } from '../exceptions/base.exception';
import { ApiErrorResponse, ErrorCode } from '../types/api-response.types';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.createErrorResponse(exception, request);

    this.logger.error('Request processing failed', {
      component: 'GlobalExceptionFilter',
      method: request.method,
      path: request.url,
      errorCode: errorResponse.error.code,
      errorMessage: errorResponse.error.message,
      userAgent: request.get('user-agent'),
      ip: request.ip,
      requestId: errorResponse.error.requestId,
    });

    response.status(this.getHttpStatus(exception)).json(errorResponse);
  }

  private createErrorResponse(exception: unknown, request: Request): ApiErrorResponse {
    const timestamp = new Date().toISOString();
    const requestId = this.generateRequestId();

    // Handle our custom business exceptions
    if (exception instanceof BaseApiException) {
      return {
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
          details: exception.details,
          field: exception.field,
          timestamp,
          requestId,
          path: request.path,
        },
        meta: {
          timestamp,
          requestId,
          version: process.env.npm_package_version || '1.0.0',
        },
      };
    }

    // Handle Prisma database errors
    if (exception instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, request, timestamp, requestId);
    }

    if (exception instanceof PrismaClientValidationError) {
      return {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Database validation error',
          details: { prismaError: exception.message },
          timestamp,
          requestId,
          path: request.path,
        },
        meta: { timestamp, requestId },
      };
    }

    // Handle standard NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const message =
        typeof response === 'string' ? response : (response as any).message || exception.message;

      return {
        success: false,
        error: {
          code: this.getErrorCodeFromHttpStatus(exception.getStatus()),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          message: Array.isArray(message) ? message.join(', ') : message,

          details: typeof response === 'object' ? response : undefined,
          timestamp,
          requestId,
          path: request.path,
        },
        meta: { timestamp, requestId },
      };
    }

    // Handle unknown errors
    const errorMessage = exception instanceof Error ? exception.message : 'Unknown error occurred';

    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: errorMessage,
        timestamp,
        requestId,
        path: request.path,
      },
      meta: { timestamp, requestId },
    };
  }

  private handlePrismaError(
    exception: PrismaClientKnownRequestError,
    request: Request,
    timestamp: string,
    requestId: string,
  ): ApiErrorResponse {
    switch (exception.code) {
      case 'P2002': // Unique constraint failed
        return {
          success: false,
          error: {
            code: ErrorCode.CONFLICT,
            message: 'Resource already exists',
            details: {
              fields: exception.meta?.target,
              prismaCode: exception.code,
            },
            timestamp,
            requestId,
            path: request.path,
          },
          meta: { timestamp, requestId },
        };

      case 'P2025': // Record not found
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: 'Resource not found',
            details: {
              cause: exception.meta?.cause,
              prismaCode: exception.code,
            },
            timestamp,
            requestId,
            path: request.path,
          },
          meta: { timestamp, requestId },
        };

      case 'P2003': // Foreign key constraint failed
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Related resource not found',
            details: {
              field: exception.meta?.field_name,
              prismaCode: exception.code,
            },
            field: exception.meta?.field_name as string,
            timestamp,
            requestId,
            path: request.path,
          },
          meta: { timestamp, requestId },
        };

      default:
        return {
          success: false,
          error: {
            code: ErrorCode.DATABASE_QUERY_FAILED,
            message: 'Database operation failed',
            details: {
              prismaCode: exception.code,
              prismaMessage: exception.message,
            },
            timestamp,
            requestId,
            path: request.path,
          },
          meta: { timestamp, requestId },
        };
    }
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof BaseApiException) {
      return exception.httpStatus;
    }

    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorCodeFromHttpStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_REQUESTS;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
