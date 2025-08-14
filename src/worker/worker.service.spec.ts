import { Test, TestingModule } from '@nestjs/testing';
import { WorkerService } from './worker.service';
import { YellowApiService } from './yellow-api.service';
import { ChannelService } from './channel/channel.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodeConfigService } from './node-config/node-config.service';
import { AssetService } from './asset/asset.service';
import { HealthService } from './health/health.service';
import { AppSessionService } from './app-session/app-session.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import workerCfg from './worker.config';
import { ConfigModule } from '@nestjs/config';

describe('WorkerService', () => {
  let service: WorkerService;

  const mockConfig = {
    channelSyncIntervalMinutes: 5,
    assetSyncIntervalMinutes: 60,
    appSessionSyncIntervalMinutes: 30,
    syncBatchSize: 1000,
  };

  const mockServices = {
    yellowApiService: { waitUntilOpen: jest.fn() },
    channelService: { processChannels: jest.fn() },
    prismaService: {
      workerState: { upsert: jest.fn(), findUnique: jest.fn() },
      nodeConfig: { findFirst: jest.fn() },
    },
    nodeConfigService: { sync: jest.fn() },
    assetService: { syncAll: jest.fn() },
    healthService: { check: jest.fn() },
    appSessionService: { syncAll: jest.fn() },
    schedulerRegistry: { addCronJob: jest.fn(), deleteCronJob: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(workerCfg)],
      providers: [
        WorkerService,
        { provide: YellowApiService, useValue: mockServices.yellowApiService },
        { provide: ChannelService, useValue: mockServices.channelService },
        { provide: PrismaService, useValue: mockServices.prismaService },
        { provide: NodeConfigService, useValue: mockServices.nodeConfigService },
        { provide: AssetService, useValue: mockServices.assetService },
        { provide: HealthService, useValue: mockServices.healthService },
        { provide: AppSessionService, useValue: mockServices.appSessionService },
        { provide: SchedulerRegistry, useValue: mockServices.schedulerRegistry },
        { provide: workerCfg.KEY, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<WorkerService>(WorkerService);

    // Mock the onModuleInit to prevent automatic startup during tests
    jest.spyOn(service, 'onModuleInit').mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
