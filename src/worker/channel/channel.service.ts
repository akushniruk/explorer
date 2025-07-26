import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetChannelsResponseParams } from '@erc7824/nitrolite';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async processChannels(channels: GetChannelsResponseParams): Promise<void> {
    if (!channels || channels.length === 0) return;

    this.logger.log(`Processing and saving ${channels.length} channels...`);

    for (const channel of channels) {
      const dataToUpsert = {
        channel_id: channel.channelId,
        participant: channel.participant,
        status: channel.status,
        token: channel.token,
        wallet: channel.wallet,
        amount: channel.amount as bigint,
        chain_id: channel.chainId,
        adjudicator: channel.adjudicator,
        challenge: channel.challenge,
        nonce: channel.nonce as bigint,
        version: channel.version,
      };

      this.logger.log(
        `Upserting channel ${dataToUpsert.channel_id} with status ${dataToUpsert.status}`,
      );

      await this.prisma.channel.upsert({
        where: { channel_id: dataToUpsert.channel_id },
        create: dataToUpsert,
        update: dataToUpsert,
      });
    }

    this.logger.log(`Successfully saved batch of ${channels.length} channels.`);
  }
}
