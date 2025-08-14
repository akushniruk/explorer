import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListAppSessionsQueryDto extends PaginationQueryDto {
  /** quick prefix on session_id or channel_id (case-sensitive for id fields) */
  @IsOptional()
  @IsString()
  q?: string;

  /** exact filter */
  @IsOptional()
  @IsString()
  status?: string;

  /** exact filter */
  @IsOptional()
  @IsString()
  channelId?: string;

  /** exact participant address (array has) */
  @IsOptional()
  @IsString()
  participant?: string;

  /** sort field */
  @IsOptional()
  @IsIn(['updated_at', 'created_at', 'version'])
  sortBy?: 'updated_at' | 'created_at' | 'version' = 'updated_at';

  /** sort order */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
