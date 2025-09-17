import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NodeConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    const config = await this.prisma.nodeConfig.findFirst();

    if (!config) {
      throw new NotFoundException('NodeConfig not found');
    }

    return config;
  }
}
