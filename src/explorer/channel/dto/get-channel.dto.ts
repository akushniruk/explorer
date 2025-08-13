import { IsNotEmpty, IsString } from 'class-validator';

export class GetChannelQueryDto {
  @IsString()
  @IsNotEmpty()
  channelId!: string;
}
