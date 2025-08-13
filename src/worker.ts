// src/worker.ts
import { NestFactory } from '@nestjs/core';
import { Logger, INestApplicationContext } from '@nestjs/common';
import { WorkerModule } from './worker/worker.module';
import { PrismaService } from './prisma/prisma.service';

const logger = new Logger('WorkerBootstrap');

async function bootstrap() {
  let app: INestApplicationContext | undefined;

  try {
    app = await NestFactory.createApplicationContext(WorkerModule);

    // Optional: warm Prisma and register shutdown hooks (no-op if PrismaService not present)
    try {
      const prisma = app.get(PrismaService, { strict: false });

      if (prisma?.$connect) {
        await prisma.$connect();
        logger.debug('Prisma connected');
      }

      // Many PrismaService templates expose this helper
      if (typeof (prisma as any)?.enableShutdownHooks === 'function') {
        await (prisma as any).enableShutdownHooks(app);
      }
    } catch (e) {
      logger.debug(`Prisma warm-up skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    logger.log(
      `Worker process started successfully | pid=${process.pid} | ts=${new Date().toISOString()}`,
    );

    // Graceful shutdown
    const shutdown = async (signal: NodeJS.Signals) => {
      logger.warn(`Shutdown signal received: ${signal}`);

      try {
        await app?.close();
        logger.log('Nest application context closed gracefully');
      } catch (err) {
        logger.error(
          `Error during app.close(): ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGQUIT', () => void shutdown('SIGQUIT'));
  } catch (error) {
    logger.error(
      `Failed to start worker process: ${error instanceof Error ? error.message : String(error)}`,
    );

    try {
      await app?.close();
    } catch {
      /* noop */
    }

    process.exit(1);
  }
}

void bootstrap();
