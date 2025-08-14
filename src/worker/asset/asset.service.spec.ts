import { Test, TestingModule } from '@nestjs/testing';
import { AssetService } from './asset.service';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';

describe('AssetService', () => {
  let service: AssetService;

  const mockPrismaService = {
    asset: {
      upsert: jest.fn(),
    },
  };

  const mockYellowApiService = {
    getAssets: jest.fn(),
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
