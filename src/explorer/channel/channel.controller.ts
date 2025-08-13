import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChannelService } from './channel.service';
import { GetChannelQueryDto } from './dto/get-channel.dto';
import { ListChannelsQueryDto } from './dto/list-channels.dto';

@Controller({ path: 'channel', version: '1' })
export class ChannelController {
  constructor(private readonly svc: ChannelService) {}

  /** Single channel by params (query) */
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=5')
  getOneByQuery(@Query() q: GetChannelQueryDto) {
    return this.svc.getOne(q);
  }

  /** List with pagination + total */
  @Get('list')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=5')
  list(@Query() q: ListChannelsQueryDto) {
    return this.svc.list(q);
  }

  /** Total count (lightweight) */
  @Get('count')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=15')
  count(@Query() q: Pick<ListChannelsQueryDto, 'status' | 'token' | 'chainId'>) {
    return this.svc.count(q);
  }

  /** Convenience: single channel by path */
  @Get('/:id')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=5')
  getOneByPath(@Param('id') id: string) {
    return this.svc.getOne({ channelId: id });
  }
}
