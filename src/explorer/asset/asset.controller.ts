import { Controller, Get, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AssetService } from './asset.service';
import { GetAssetQueryDto } from './dto/get-asset.dto';
import { ListAssetsQueryDto } from './dto/list-assets.dto';

@Controller({ path: 'asset', version: '1' })
export class AssetController {
  constructor(private readonly svc: AssetService) {}

  /** Single asset by composite key (token + chainId) */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200')
  getOne(@Query() q: GetAssetQueryDto) {
    return this.svc.getOne(q);
  }

  /** List with pagination + filters */
  @Get('list')
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600')
  list(@Query() q: ListAssetsQueryDto) {
    return this.svc.list(q);
  }

  /** Total count (filtered subset) */
  @Get('count')
  @Throttle({ default: { limit: 120, ttl: 60 } })
  @Header('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600')
  count(@Query() q: Pick<ListAssetsQueryDto, 'token' | 'chainId' | 'q'>) {
    return this.svc.count(q);
  }
}
