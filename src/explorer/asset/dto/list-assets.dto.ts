import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListAssetsQueryDto extends PaginationQueryDto {
  /** contains match on symbol (case-insensitive) */
  @IsOptional()
  @IsString()
  q?: string;

  /** exact token */
  @IsOptional()
  @IsString()
  token?: string;

  /** exact chain id */
  @IsOptional()
  @IsNumberString()
  chainId?: string;

  /** sort field */
  @IsOptional()
  @IsIn(['symbol', 'token', 'chain_id'])
  sortBy?: 'symbol' | 'token' | 'chain_id' = 'symbol';

  /** sort order */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}
