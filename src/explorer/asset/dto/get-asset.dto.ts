import { IsNotEmpty, IsString, IsNumberString } from 'class-validator';

export class GetAssetQueryDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsNumberString()
  chainId!: string; // BigInt this in the service
}
