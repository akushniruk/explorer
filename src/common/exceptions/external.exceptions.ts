import { HttpStatus } from '@nestjs/common';
import { BaseApiException } from './base.exception';
import { ErrorCode } from '../types/api-response.types';

export class YellowApiConnectionException extends BaseApiException {
  constructor(url?: string, details?: any) {
    super(
      ErrorCode.YELLOW_API_CONNECTION_FAILED,
      `Failed to connect to Yellow API${url ? ` at ${url}` : ''}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      { url, ...details },
    );
  }
}

export class YellowApiTimeoutException extends BaseApiException {
  constructor(timeout: number, operation?: string, details?: any) {
    super(
      ErrorCode.YELLOW_API_TIMEOUT,
      `Yellow API ${operation || 'operation'} timed out after ${timeout}ms`,
      HttpStatus.GATEWAY_TIMEOUT,
      { timeout, operation, ...details },
    );
  }
}

export class YellowApiInvalidResponseException extends BaseApiException {
  constructor(operation?: string, details?: any) {
    super(
      ErrorCode.YELLOW_API_INVALID_RESPONSE,
      `Invalid response from Yellow API${operation ? ` for ${operation}` : ''}`,
      HttpStatus.BAD_GATEWAY,
      { operation, ...details },
    );
  }
}

export class DatabaseConnectionException extends BaseApiException {
  constructor(details?: any) {
    super(
      ErrorCode.DATABASE_CONNECTION_FAILED,
      'Database connection failed',
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}

export class DatabaseQueryException extends BaseApiException {
  constructor(operation: string, details?: any) {
    super(
      ErrorCode.DATABASE_QUERY_FAILED,
      `Database query failed: ${operation}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { operation, ...details },
    );
  }
}

export class SyncInProgressException extends BaseApiException {
  constructor(syncType?: string, details?: any) {
    super(
      ErrorCode.SYNC_IN_PROGRESS,
      `Synchronization ${syncType || 'operation'} is already in progress`,
      HttpStatus.CONFLICT,
      { syncType, ...details },
    );
  }
}

export class SyncFailedException extends BaseApiException {
  constructor(syncType: string, reason?: string, details?: any) {
    super(
      ErrorCode.SYNC_FAILED,
      `${syncType} synchronization failed${reason ? `: ${reason}` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { syncType, reason, ...details },
    );
  }
}

export class WorkerNotInitializedException extends BaseApiException {
  constructor(details?: any) {
    super(
      ErrorCode.WORKER_NOT_INITIALIZED,
      'Worker service is not properly initialized',
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}
