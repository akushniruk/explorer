import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [PrismaModule, WorkerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
