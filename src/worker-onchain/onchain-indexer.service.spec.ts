import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import workerOnchainCfg from './worker-onchain.config';
import { OnchainIndexerService } from './onchain-indexer.service';

describe('OnchainIndexerService', () => {
  let service: OnchainIndexerService;
  const addInterval = jest.fn();
  const getInterval = jest.fn();
  const deleteInterval = jest.fn();
  const findMany = jest.fn();

  const schedulerMock = {
    addInterval,
    getInterval,
    deleteInterval,
  };

  const prismaMock = {
    onchainChainConfig: {
      findMany,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  async function setup(enabled: boolean) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnchainIndexerService,
        { provide: SchedulerRegistry, useValue: schedulerMock },
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: workerOnchainCfg.KEY,
          useValue: {
            enabled,
            syncIntervalMs: 10_000,
            maxChainsPerTick: 10,
          },
        },
      ],
    }).compile();

    service = module.get(OnchainIndexerService);
  }

  it('does not schedule when disabled', async () => {
    await setup(false);

    await service.onModuleInit();

    expect(addInterval).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('queries enabled chains on sync tick when enabled', async () => {
    await setup(true);
    findMany.mockResolvedValueOnce([
      { chain_id: BigInt(80002), channel_hub_address: '0xhub', enabled: true },
    ]);

    await service.handleSyncTick();

    expect(findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: { chain_id: 'asc' },
      take: 10,
    });
  });

  it('warns once when onchain table is missing', async () => {
    await setup(true);
    const warnSpy = jest.spyOn((service as any).logger, 'warn');
    const missingTableError = new Error('relation "onchain_chain_configs" does not exist');

    findMany.mockRejectedValue(missingTableError);

    await service.handleSyncTick();
    await service.handleSyncTick();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Onchain tables are not migrated yet. Run Prisma migrations before enabling indexer.',
    );
  });
});
