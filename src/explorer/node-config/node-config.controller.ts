import { Controller, Get, Header } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NodeConfigService } from './node-config.service';

@Controller({ path: 'node-config', version: '1' })
export class NodeConfigController {
  constructor(private readonly svc: NodeConfigService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600')
  getConfig() {
    return this.svc.getConfig();
  }
}
