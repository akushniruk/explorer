import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  console.log('Worker process started successfully.');
}

void bootstrap();
