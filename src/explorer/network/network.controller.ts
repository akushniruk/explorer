import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NetworkService } from './network.service';
import { GetNetworkQueryDto } from './dto/get-network.dto';
import { ListNetworksQueryDto } from './dto/list-networks.dto';

@Controller({ path: 'network', version: '1' })
export class NetworkController {
  constructor(private readonly svc: NetworkService) {}

  /** Single network by query */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=15')
  getOneByQuery(@Query() q: GetNetworkQueryDto) {
    return this.svc.getOne(q);
  }

  /** List with pagination + filters */
  @Get('list')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=15')
  list(@Query() q: ListNetworksQueryDto) {
    return this.svc.list(q);
  }

  /** Total count */
  @Get('count')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  count(@Query() q: Pick<ListNetworksQueryDto, 'chainId' | 'q' | 'broker'>) {
    return this.svc.count(q);
  }

  /** Single by path (put after list/count to avoid capture) */
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=15')
  getOneByPath(@Param('id') id: string) {
    return this.svc.getOne({ chainId: id });
  }
}
