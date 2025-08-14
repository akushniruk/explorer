import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { VersionService } from './version.service';
import { ETAG_RESOURCE_KEY } from './etag.decorator';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  private readonly logger = new Logger(EtagInterceptor.name);
  private readonly isEnabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly versionService: VersionService,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled = this.configService.get<string>('ENABLE_ETAG') === 'true';
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // Skip if ETags are disabled
    if (!this.isEnabled) {
      return next.handle();
    }

    const resourceKey = this.reflector.get<string>(ETAG_RESOURCE_KEY, context.getHandler());

    // Skip if no @EtagResource decorator
    if (!resourceKey) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only apply to GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    try {
      // Generate ETag based on resource state and query
      const version = await this.versionService.getVersion(resourceKey, request.query);
      const etag = `W/"${version}"`;

      // Set Cache-Control header
      const cacheControl = 'private, max-age=0, must-revalidate';

      response.setHeader('Cache-Control', cacheControl);

      // Check If-None-Match header
      const ifNoneMatch = request.headers['if-none-match'];

      if (ifNoneMatch && ifNoneMatch === etag) {
        this.logger.debug(`ETag matched for ${resourceKey}, returning 304`, {
          resource: resourceKey,
          etag,
        });

        response.status(HttpStatus.NOT_MODIFIED);
        response.end();

        return new Observable((observer) => observer.complete());
      }

      // Set ETag header and continue with request
      response.setHeader('ETag', etag);

      return next.handle().pipe(
        map((data: unknown) => {
          this.logger.debug(`ETag set for ${resourceKey}`, {
            resource: resourceKey,
            etag,
          });

          return data;
        }),
      );
    } catch (error) {
      this.logger.error(`ETag processing failed for ${resourceKey}: ${error.message}`, {
        resource: resourceKey,
        error: error.stack,
      });

      // Continue with request on error
      return next.handle();
    }
  }
}
