import { Test, TestingModule } from '@nestjs/testing';
import { AssetService } from './asset.service';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';
import { CacheService } from '../../common/cache';

describe('AssetService', () => {
  let service: AssetService;

  const mockPrismaService = {
    $executeRawUnsafe: jest.fn(),
  };

  const mockYellowApiService = {
    getAssets: jest.fn(),
  };

  const mockCacheService = {
    invalidateAssets: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetService,
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

    service = module.get<AssetService>(AssetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
