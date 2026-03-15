import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import workerOnchainCfg from './worker-onchain.config';
import { OnchainIndexerService } from './onchain-indexer.service';
import { ChainProcessorService } from './chain-processor.service';

describe('OnchainIndexerService', () => {
  let service: OnchainIndexerService;

  const addInterval = jest.fn();
  const getInterval = jest.fn();
  const deleteInterval = jest.fn();
  const findMany = jest.fn();
  const processChain = jest.fn();

  const schedulerMock = { addInterval, getInterval, deleteInterval };
  const prismaMock = { onchainChainConfig: { findMany } };
  const chainProcessorMock = { processChain };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnchainIndexerService,
        { provide: SchedulerRegistry, useValue: schedulerMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: ChainProcessorService, useValue: chainProcessorMock },
        {
          provide: workerOnchainCfg.KEY,
          useValue: {
            enabled: true,
            infuraApiKey: 'infura-key',
            syncIntervalMs: 10_000,
            maxChainsPerTick: 10,
          },
        },
      ],
    }).compile();

    service = module.get(OnchainIndexerService);
  });

  it('queries enabled chains only from DB config', async () => {
    findMany.mockResolvedValueOnce([]);

    await service.handleSyncTick();

    expect(findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: { chain_id: 'asc' },
      take: 10,
    });
  });

  it('delegates each chain to ChainProcessorService', async () => {
    const chain = {
      chain_id: BigInt(80002),
      channel_hub_address: '0x1111111111111111111111111111111111111111',
      rpc_url: 'https://custom-rpc.local',
      enabled: true,
      start_block: BigInt(100),
      last_synced_block: null,
    };

    findMany.mockResolvedValueOnce([chain]);
    processChain.mockResolvedValueOnce(undefined);

    await service.handleSyncTick();

    expect(processChain).toHaveBeenCalledWith(chain);
  });

  it('warns once when onchain table is missing', async () => {
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

  it('does not schedule when disabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnchainIndexerService,
        { provide: SchedulerRegistry, useValue: schedulerMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: ChainProcessorService, useValue: chainProcessorMock },
        {
          provide: workerOnchainCfg.KEY,
          useValue: {
            enabled: false,
            syncIntervalMs: 10_000,
            maxChainsPerTick: 10,
          },
        },
      ],
    }).compile();

    const disabledService = module.get(OnchainIndexerService);

    await disabledService.onModuleInit();

    expect(addInterval).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});
