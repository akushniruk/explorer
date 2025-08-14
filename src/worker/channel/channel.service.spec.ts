import { Test, TestingModule } from '@nestjs/testing';
import { ChannelService } from './channel.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GetChannelsResponseParams } from '@erc7824/nitrolite';

describe('ChannelService', () => {
  let service: ChannelService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    channel: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChannelService>(ChannelService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processChannels', () => {
    it('should handle empty channel array', async () => {
      await service.processChannels([]);
      expect(mockPrismaService.channel.upsert).not.toHaveBeenCalled();
    });

    it('should handle null channels', async () => {
      await service.processChannels(null as GetChannelsResponseParams);
      expect(mockPrismaService.channel.upsert).not.toHaveBeenCalled();
    });

    it('should process single channel', async () => {
      const mockChannel: GetChannelsResponseParams[0] = {
        channelId: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
        participant: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
        status: 'Open' as any,
        token: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
        wallet: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
        amount: BigInt(1000),
        chainId: 1,
        adjudicator: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
        challenge: 123,
        nonce: BigInt(1),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.channel.upsert.mockResolvedValue(mockChannel as any);

      await service.processChannels([mockChannel]);

      expect(mockPrismaService.channel.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.channel.upsert).toHaveBeenCalledWith({
        where: { channel_id: '0x1234567890abcdef1234567890abcdef12345678' },
        create: {
          channel_id: '0x1234567890abcdef1234567890abcdef12345678',
          participant: '0x1234567890abcdef1234567890abcdef12345678',
          status: 'Open',
          token: '0x1234567890abcdef1234567890abcdef12345678',
          wallet: '0x1234567890abcdef1234567890abcdef12345678',
          amount: BigInt(1000),
          chain_id: 1,
          adjudicator: '0x1234567890abcdef1234567890abcdef12345678',
          challenge: 123,
          nonce: BigInt(1),
          version: 1,
        },
        update: {
          channel_id: '0x1234567890abcdef1234567890abcdef12345678',
          participant: '0x1234567890abcdef1234567890abcdef12345678',
          status: 'Open',
          token: '0x1234567890abcdef1234567890abcdef12345678',
          wallet: '0x1234567890abcdef1234567890abcdef12345678',
          amount: BigInt(1000),
          chain_id: 1,
          adjudicator: '0x1234567890abcdef1234567890abcdef12345678',
          challenge: 123,
          nonce: BigInt(1),
          version: 1,
        },
      });
    });

    it('should process multiple channels', async () => {
      const mockChannels: GetChannelsResponseParams = [
        {
          channelId: '0x1111111111111111111111111111111111111111' as `0x${string}`,
          participant: '0x2222222222222222222222222222222222222222' as `0x${string}`,
          status: 'Open' as any,
          token: '0x3333333333333333333333333333333333333333' as `0x${string}`,
          wallet: '0x4444444444444444444444444444444444444444' as `0x${string}`,
          amount: BigInt(1000),
          chainId: 1,
          adjudicator: '0x5555555555555555555555555555555555555555' as `0x${string}`,
          challenge: 123,
          nonce: BigInt(1),
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          channelId: '0x6666666666666666666666666666666666666666' as `0x${string}`,
          participant: '0x7777777777777777777777777777777777777777' as `0x${string}`,
          status: 'Closing' as any,
          token: '0x8888888888888888888888888888888888888888' as `0x${string}`,
          wallet: '0x9999999999999999999999999999999999999999' as `0x${string}`,
          amount: BigInt(2000),
          chainId: 1,
          adjudicator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
          challenge: 456,
          nonce: BigInt(2),
          version: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest
        .spyOn(prismaService.channel, 'upsert')
        .mockImplementation(() => Promise.resolve({} as any));

      await service.processChannels(mockChannels);

      expect(mockPrismaService.channel.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
