export class Dto {}
import { IsNotEmpty, IsString } from 'class-validator';

export class GetAppSessionQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
