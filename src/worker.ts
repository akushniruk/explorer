import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker/worker.module';

const logger = new Logger('WorkerBootstrap');

async function bootstrap() {
  try {
    await NestFactory.createApplicationContext(WorkerModule);
    logger.log('Worker process started successfully', {
      component: 'WorkerBootstrap',
      action: 'startup',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to start worker process', {
      component: 'WorkerBootstrap',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    process.exit(1);
  }
}

void bootstrap();
