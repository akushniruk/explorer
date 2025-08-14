import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

// Keep in sync with your Prisma enum
export type NodeRegion =
  | 'europe'
  | 'north_america'
  | 'south_america'
  | 'africa'
  | 'asia_pacific'
  | 'middle_east';

export type NodeStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export class ListNodesQueryDto extends PaginationQueryDto {
  /** case-insensitive contains on name */
  @IsOptional()
  @IsString()
  q?: string;

  /** ISO-3166 alpha-2 country code (e.g. DE, US) */
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;

  /** Region enum */
  @IsOptional()
  @IsIn(['europe', 'north_america', 'south_america', 'africa', 'asia_pacific', 'middle_east'])
  region?: NodeRegion;

  /** Status enum */
  @IsOptional()
  @IsIn(['online', 'degraded', 'offline', 'unknown'])
  status?: NodeStatus;

  /** Bounding box filter: minLat,minLng,maxLat,maxLng */
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
  bbox?: string;

  /** sort field */
  @IsOptional()
  @IsIn(['name', 'updated_at', 'status', 'region'])
  sortBy?: 'name' | 'updated_at' | 'status' | 'region' = 'name';

  /** sort order */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}
