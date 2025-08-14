import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListNetworksQueryDto extends PaginationQueryDto {
  /** contains match on name (case-insensitive) */
  @IsOptional()
  @IsString()
  q?: string;

  /** exact chain id */
  @IsOptional()
  @IsNumberString()
  chainId?: string;

  /** exact broker address (if needed) */
  @IsOptional()
  @IsString()
  broker?: string;

  /** sort field */
  @IsOptional()
  @IsIn(['name', 'chain_id', 'last_seen_at', 'updated_at'])
  sortBy?: 'name' | 'chain_id' | 'last_seen_at' | 'updated_at' = 'name';

  /** sort order */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}
