import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    // Dynamically import CJS middlewares and normalize the export shape
    const [helmetMod, compressionMod] = await Promise.all([
      import('helmet'),
      import('compression'),
    ]);

    const helmetFn = (helmetMod as any).default ?? (helmetMod as any); // default or module function
    const compressionFn = (compressionMod as any).default ?? (compressionMod as any);

    // Configure CORS from environment variable
    const corsOrigins = process.env.CORS_ORIGINS || '*';
    const corsConfig = corsOrigins === '*'
      ? true
      : { origin: corsOrigins.split(',').map(o => o.trim()), credentials: true };

    const app = await NestFactory.create(AppModule, { cors: corsConfig });

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: 'v1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Configure Helmet to NOT override cache-control headers set by controllers
    // This allows our custom cache headers to work properly
    app.use(
      helmetFn({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        // Don't set cache-control headers - let our controllers handle it
        // This is critical for the caching optimization to work
      }),
    );
    app.use(compressionFn());

    const port = Number(process.env.PORT) || 3000;

    await app.listen(port);
    console.log(`Application is running on port ${port}`);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

void bootstrap();
