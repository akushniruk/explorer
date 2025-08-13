import { Module } from '@nestjs/common';
import { ApiClient } from './api-client.provider';

@Module({
  providers: [ApiClient],
  exports: [ApiClient],
})
export class ApiModule {}
