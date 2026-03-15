import { NestFactory } from '@nestjs/core';
import { Logger, INestApplicationContext } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { WorkerOnchainModule } from './worker-onchain/worker-onchain.module';

const logger = new Logger('WorkerOnchainBootstrap');

async function bootstrap() {
  let app: INestApplicationContext | undefined;

  try {
    app = await NestFactory.createApplicationContext(WorkerOnchainModule);

    try {
      const prisma = app.get(PrismaService, { strict: false });

      if (prisma?.$connect) {
        await prisma.$connect();
        logger.debug('Prisma connected');
      }

      if (typeof (prisma as any)?.enableShutdownHooks === 'function') {
        await (prisma as any).enableShutdownHooks(app);
      }
    } catch (e) {
      logger.debug(`Prisma warm-up skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    logger.log(
      `Onchain worker process started | pid=${process.pid} | ts=${new Date().toISOString()}`,
    );

    const shutdown = async (signal: NodeJS.Signals) => {
      logger.warn(`Shutdown signal received: ${signal}`);

      try {
        await app?.close();
        logger.log('Onchain Nest application context closed gracefully');
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
      `Failed to start onchain worker process: ${error instanceof Error ? error.message : String(error)}`,
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
