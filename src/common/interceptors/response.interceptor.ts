import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../types/api-response.types';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    const timestamp = new Date().toISOString();
    const requestId = this.generateRequestId();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return next.handle().pipe(
      map((data) => {
        // If data is already formatted as ApiResponse, don't wrap it again
        if (data && typeof data === 'object' && 'success' in data) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return data;
        }

        // Handle paginated responses
        if (this.isPaginatedResponse(data)) {
          // Extract pagination fields
          const { items, page, limit, total, totalPages, ...otherFields } = data;

          return {
            success: true,
            data: {
              items,
              ...otherFields, // Preserve additional fields like participants, lookupType, wallet
            },
            meta: {
              timestamp,
              requestId,
              version: process.env.npm_package_version || '1.0.0',
              pagination: {
                page,
                limit,
                total,
                totalPages,
              },
            },
          };
        }

        // Standard success response
        return {
          success: true,

          data,
          meta: {
            timestamp,
            requestId,
            version: process.env.npm_package_version || '1.0.0',
          },
        };
      }),
    );
  }

  private isPaginatedResponse(
    data: any,
  ): data is { items: any[]; page: number; limit: number; total: number; totalPages: number } {
    return Boolean(
      data &&
        typeof data === 'object' &&
        'items' in data &&
        'page' in data &&
        'limit' in data &&
        'total' in data &&
        'totalPages' in data,
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
