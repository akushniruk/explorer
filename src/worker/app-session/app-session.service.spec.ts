import { Test, TestingModule } from '@nestjs/testing';
import { AppSessionService } from './app-session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { YellowApiService } from '../yellow-api.service';
import workerCfg from '../worker.config';
import { ConfigModule } from '@nestjs/config';

describe('AppSessionService', () => {
  let service: AppSessionService;

  const mockConfig = {
    appSessionBatchSize: 100,
  };

  const mockPrismaService = {
    appSession: {
      upsert: jest.fn(),
    },
  };

  const mockYellowApiService = {
    getAppSessions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(workerCfg)],
      providers: [
        AppSessionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: YellowApiService,
          useValue: mockYellowApiService,
        },
        {
          provide: workerCfg.KEY,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<AppSessionService>(AppSessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
