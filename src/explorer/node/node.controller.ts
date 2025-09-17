import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NodeService } from './node.service';
import { ListNodesQueryDto } from './dto/list-nodes.dto';
import { EtagResource } from '../../common/etag';

@Controller({ path: 'nodes', version: '1' })
export class NodeController {
  constructor(private readonly svc: NodeService) {}

  /** Single node by query */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  single(@Query() q: Pick<ListNodesQueryDto, 'q'>) {
    return this.svc.single(q);
  }

  /** Paginated list with filters suitable for a map */
  @Get('list')
  @EtagResource('nodes')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  list(@Query() q: ListNodesQueryDto) {
    return this.svc.list(q);
  }

  /** Total count with filters */
  @Get('count')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  count(@Query() q: Pick<ListNodesQueryDto, 'q' | 'country' | 'region' | 'status' | 'bbox'>) {
    return this.svc.count(q);
  }

  /** Active nodes count */
  @Get('count-active')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  countActive() {
    return this.svc.countActive();
  }

  /** Get node by address */
  @Get(':address')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  findByAddress(@Param('address') address: string) {
    return this.svc.findByAddress(address);
  }
}
