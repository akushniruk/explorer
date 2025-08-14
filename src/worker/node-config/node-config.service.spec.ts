import { Test, TestingModule } from '@nestjs/testing';
import { NodeConfigService } from './node-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';

describe('NodeConfigService', () => {
  let service: NodeConfigService;

  const mockPrismaService = {
    nodeConfig: {
      upsert: jest.fn(),
    },
  };

  const mockYellowApiService = {
    getConfig: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeConfigService,
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

    service = module.get<NodeConfigService>(NodeConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
