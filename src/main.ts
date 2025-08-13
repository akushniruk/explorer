import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Dynamically import CJS middlewares and normalize the export shape
  const [helmetMod, compressionMod] = await Promise.all([import('helmet'), import('compression')]);

  const helmetFn = (helmetMod as any).default ?? (helmetMod as any); // default or module function
  const compressionFn = (compressionMod as any).default ?? (compressionMod as any);

  const app = await NestFactory.create(AppModule, { cors: true });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: 'v1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.use(helmetFn());
  app.use(compressionFn());

  await app.listen(Number(process.env.PORT) || 3000);
}

void bootstrap();
