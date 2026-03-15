import { Test, TestingModule } from '@nestjs/testing';
import { ChannelService } from './channel.service';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';
import { CacheService } from '../../common/cache';

describe('ChannelService', () => {
  let service: ChannelService;

  const mockPrismaService = {
    $executeRawUnsafe: jest.fn(),
  };

  const mockYellowApiService = {
    getAssets: jest.fn(),
  };

  const mockCacheService = {
    invalidateAssets: jest.fn(),
    invalidateChannels: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: YellowApiService,
          useValue: mockYellowApiService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ChannelService>(ChannelService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should no-op on empty channel list', async () => {
    await service.processChannels({ channels: [] } as any);

    expect(mockYellowApiService.getAssets).not.toHaveBeenCalled();
    expect(mockPrismaService.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(mockCacheService.invalidateChannels).not.toHaveBeenCalled();
  });

  it('should process channels and write bulk SQL once for channels chunk', async () => {
    mockYellowApiService.getAssets.mockResolvedValue({ params: { assets: [] } });
    mockPrismaService.$executeRawUnsafe.mockResolvedValue(1);

    const now = new Date();

    await service.processChannels({
      channels: [
        {
          channelId: '0x1234567890abcdef1234567890abcdef12345678',
          participant: '0x1234567890abcdef1234567890abcdef12345678',
          status: 'Open',
          token: '0x1234567890abcdef1234567890abcdef12345678',
          wallet: '0x1234567890abcdef1234567890abcdef12345678',
          amount: BigInt(1000),
          chainId: 1,
          adjudicator: '0x1234567890abcdef1234567890abcdef12345678',
          challenge: 123,
          nonce: 1,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
    } as any);

    expect(mockYellowApiService.getAssets).toHaveBeenCalledWith(1);
    expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockCacheService.invalidateChannels).toHaveBeenCalledTimes(1);

    const sql = mockPrismaService.$executeRawUnsafe.mock.calls[0][0] as string;

    expect(sql).toContain('INSERT INTO "channels"');
    expect(sql).toContain('ON CONFLICT ("channel_id")');
  });
});
