import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import workerCfg from './worker.config';
import { WorkerService } from './worker.service';
import { YellowApiService } from './yellow-api.service';
import { ChannelService } from './channel/channel.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodeConfigService } from './node-config/node-config.service';
import { AssetService } from './asset/asset.service';
import { HealthService } from './health/health.service';
import { AppSessionService } from './app-session/app-session.service';

describe('WorkerService offchain flag', () => {
  const schedulerMock = {
    addInterval: jest.fn(),
    getInterval: jest.fn(),
    deleteInterval: jest.fn(),
  };

  const yellowApiMock = {
    waitUntilOpen: jest.fn(),
  };

  const channelServiceMock = {
    processChannels: jest.fn(),
  };

  const prismaMock = {};

  const nodeConfigServiceMock = {
    warm: jest.fn(),
  };

  const assetServiceMock = {
    syncAssets: jest.fn(),
  };

  const healthServiceMock = {
    check: jest.fn(),
  };

  const appSessionServiceMock = {
    syncAllWithBudget: jest.fn(),
  };

  let service: WorkerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: SchedulerRegistry, useValue: schedulerMock },
        { provide: YellowApiService, useValue: yellowApiMock },
        { provide: ChannelService, useValue: channelServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: NodeConfigService, useValue: nodeConfigServiceMock },
        { provide: AssetService, useValue: assetServiceMock },
        { provide: HealthService, useValue: healthServiceMock },
        { provide: AppSessionService, useValue: appSessionServiceMock },
        {
          provide: workerCfg.KEY,
          useValue: {
            offchain: { enabled: false },
            wsRequestTimeoutMs: 1_000,
            sync: {
              intervalMs: 10_000,
              channelsLimit: 100,
            },
          },
        },
      ],
    }).compile();

    service = module.get(WorkerService);
  });

  it('does not schedule or warm up when OFFCHAIN_SYNC_ENABLED=false', async () => {
    await service.onModuleInit();

    expect(yellowApiMock.waitUntilOpen).not.toHaveBeenCalled();
    expect(nodeConfigServiceMock.warm).not.toHaveBeenCalled();
    expect(schedulerMock.addInterval).not.toHaveBeenCalled();
  });
});
