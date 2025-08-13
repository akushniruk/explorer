import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../types/api-response.types';

export class BaseApiException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    public readonly httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly details?: any,
    public readonly field?: string,
  ) {
    super(message, httpStatus);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        details: this.details,
        field: this.field,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
