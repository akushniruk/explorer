import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AppSessionService } from './app-session.service';
import { GetAppSessionQueryDto } from './dto/get-app-session.dto';
import { ListAppSessionsQueryDto } from './dto/list-app-sessions.dto';

@Controller({ path: 'app-session', version: '1' })
export class AppSessionController {
  constructor(private readonly svc: AppSessionService) {}

  /** Single by query */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=15')
  getOneByQuery(@Query() q: GetAppSessionQueryDto) {
    return this.svc.getOne(q);
  }

  /** List with pagination + filters */
  @Get('list')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=15')
  list(@Query() q: ListAppSessionsQueryDto) {
    return this.svc.list(q);
  }

  /** Total count */
  @Get('count')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=30')
  count(@Query() q: Pick<ListAppSessionsQueryDto, 'status' | 'channelId' | 'participant' | 'q'>) {
    return this.svc.count(q);
  }

  /** Single by path (after list/count to avoid capture) */
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=15')
  getOneByPath(@Param('id') id: string) {
    return this.svc.getOne({ sessionId: id });
  }
}
