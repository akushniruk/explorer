import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChannelService } from './channel.service';
import { GetChannelQueryDto } from './dto/get-channel.dto';
import { ListChannelsQueryDto } from './dto/list-channels.dto';
import { EtagResource } from '../../common/etag';

@Controller({ path: 'channel', version: '1' })
export class ChannelController {
  constructor(private readonly svc: ChannelService) {}

  /** Single channel by params (query) */
  @Get()
  @EtagResource('channels')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=300')
  getOneByQuery(@Query() q: GetChannelQueryDto) {
    return this.svc.getOne(q);
  }

  /** List with pagination + total */
  @Get('list')
  @EtagResource('channels')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=300')
  list(@Query() q: ListChannelsQueryDto) {
    return this.svc.list(q);
  }

  /** Total count (lightweight) */
  @Get('count')
  @EtagResource('channels')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=300')
  count(@Query() q: Pick<ListChannelsQueryDto, 'status' | 'token' | 'chainId'>) {
    return this.svc.count(q);
  }

  /** Get channels by wallet (includes participant list) */
  @Get('wallet/:address')
  @EtagResource('channels')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=180, s-maxage=180, stale-while-revalidate=300')
  getByWallet(@Param('address') address: string, @Query() q: ListChannelsQueryDto) {
    return this.svc.getByWallet(address, q);
  }

  /** Get channels by participant (session key) */
  @Get('participant/:address')
  @EtagResource('channels')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=180, s-maxage=180, stale-while-revalidate=300')
  getByParticipant(@Param('address') address: string, @Query() q: ListChannelsQueryDto) {
    return this.svc.getByParticipant(address, q);
  }

  /** Universal lookup - checks if address is wallet or participant */
  @Get('address/:address')
  @EtagResource('channels')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=180, s-maxage=180, stale-while-revalidate=300')
  getByAddress(@Param('address') address: string, @Query() q: ListChannelsQueryDto) {
    return this.svc.getByAddress(address, q);
  }

  /** Convenience: single channel by path */
  @Get('/:id')
  @EtagResource('channels')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=300')
  getOneByPath(@Param('id') id: string) {
    return this.svc.getOne({ channelId: id });
  }
}
