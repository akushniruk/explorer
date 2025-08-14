import { IsNotEmpty, IsNumberString } from 'class-validator';

export class GetNetworkQueryDto {
  @IsNumberString()
  @IsNotEmpty()
  chainId!: string; // BigInt in DB
}
