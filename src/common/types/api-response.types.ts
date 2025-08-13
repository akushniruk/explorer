export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
    timestamp: string;
    requestId?: string;
    path?: string;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export enum ErrorCode {
  // General errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Business logic errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  CHANNEL_ALREADY_CLOSED = 'CHANNEL_ALREADY_CLOSED',
  INVALID_PARTICIPANT = 'INVALID_PARTICIPANT',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',

  // External service errors
  YELLOW_API_CONNECTION_FAILED = 'YELLOW_API_CONNECTION_FAILED',
  YELLOW_API_TIMEOUT = 'YELLOW_API_TIMEOUT',
  YELLOW_API_INVALID_RESPONSE = 'YELLOW_API_INVALID_RESPONSE',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',

  // Worker specific errors
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  SYNC_FAILED = 'SYNC_FAILED',
  WORKER_NOT_INITIALIZED = 'WORKER_NOT_INITIALIZED',
}
