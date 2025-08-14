import { Controller, Get, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NodeService } from './node.service';
import { ListNodesQueryDto } from './dto/list-nodes.dto';

@Controller({ path: 'nodes', version: '1' })
export class NodeController {
  constructor(private readonly svc: NodeService) {}

  /** Paginated list with filters suitable for a map */
  @Get('list')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  list(@Query() q: ListNodesQueryDto) {
    return this.svc.list(q);
  }
}
