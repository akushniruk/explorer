import { IsIn, IsOptional, IsString, IsNumberString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListChannelsQueryDto extends PaginationQueryDto {
  /** quick prefix search: channel_id | wallet | participant */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  wallet?: string;

  @IsOptional()
  @IsString()
  participant?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsNumberString()
  chainId?: string;

  @IsOptional()
  @IsIn(['updated_at', 'created_at', 'amount'])
  sortBy?: 'updated_at' | 'created_at' | 'amount' = 'updated_at';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
