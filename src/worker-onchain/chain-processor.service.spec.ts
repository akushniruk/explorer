import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import workerOnchainCfg from './worker-onchain.config';
import { ChainProcessorService, type ChainConfig } from './chain-processor.service';
import { EventDecoderService } from './event-decoder.service';

describe('ChainProcessorService', () => {
  let service: ChainProcessorService;

  const update = jest.fn();
  const upsert = jest.fn();
  const transaction = jest.fn();

  const txMock = {
    onchainEvent: { upsert },
    onchainChainConfig: { update },
  };

  const prismaMock = {
    onchainChainConfig: { update },
    onchainEvent: { upsert },
    $transaction: transaction,
  };

  const decoderMock = {
    trackedEventSelectors: ['0x01'] as any,
    decodeLog: jest.fn(),
    filterMinedLogs: jest.fn((logs: any[]) => logs),
    groupLogsByBlock: jest.fn(),
  };

  const CHAIN: ChainConfig = {
    chain_id: BigInt(80002),
    channel_hub_address: '0x1111111111111111111111111111111111111111',
    enabled: true,
    start_block: BigInt(100),
    last_synced_block: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    transaction.mockImplementation(async (cb: (tx: typeof txMock) => Promise<void>) => cb(txMock));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainProcessorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventDecoderService, useValue: decoderMock },
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

    service = module.get(ChainProcessorService);
  });

  it('builds infura RPC URL from chain ID and API key', async () => {
    const client = {
      getBlockNumber: jest.fn().mockResolvedValue(BigInt(100)),
      getLogs: jest.fn().mockResolvedValue([]),
      getBlock: jest.fn(),
    };

    const spy = jest.spyOn(service, 'createRpcClient').mockReturnValue(client as any);
    decoderMock.filterMinedLogs.mockReturnValue([]);
    decoderMock.groupLogsByBlock.mockReturnValue(new Map());

    await service.processChain({ ...CHAIN });

    expect(spy).toHaveBeenCalledWith('https://polygon-amoy.infura.io/v3/infura-key');
  });

  it('skips chain when no infura API key is configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainProcessorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventDecoderService, useValue: decoderMock },
        {
          provide: workerOnchainCfg.KEY,
          useValue: {
            enabled: true,
            infuraApiKey: undefined,
            syncIntervalMs: 10_000,
            maxChainsPerTick: 10,
          },
        },
      ],
    }).compile();

    const localService = module.get(ChainProcessorService);
    const spy = jest.spyOn(localService, 'createRpcClient');

    await localService.processChain({ ...CHAIN });

    expect(spy).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('keeps cursor at last committed block when block N fails', async () => {
    const logs = [
      {
        address: CHAIN.channel_hub_address,
        blockNumber: BigInt(100),
        logIndex: 0,
        transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        data: '0x',
        topics: ['0x01'],
      },
      {
        address: CHAIN.channel_hub_address,
        blockNumber: BigInt(101),
        logIndex: 0,
        transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        data: '0x',
        topics: ['0x01'],
      },
    ];

    const client = {
      getBlockNumber: jest.fn().mockResolvedValue(BigInt(101)),
      getLogs: jest.fn().mockResolvedValue(logs),
      getBlock: jest.fn().mockResolvedValue({ timestamp: BigInt(1773573035) }),
    };

    jest.spyOn(service, 'createRpcClient').mockReturnValue(client as any);

    decoderMock.filterMinedLogs.mockReturnValue(logs);
    decoderMock.groupLogsByBlock.mockReturnValue(
      new Map([
        ['100', [logs[0]]],
        ['101', [logs[1]]],
      ]),
    );

    decoderMock.decodeLog.mockImplementation((log: any) => {
      if (log.blockNumber === BigInt(101)) {
        throw new Error('decode failed at block 101');
      }

      return {
        eventName: 'ChannelCreated',
        channelId: '0xchannel',
        userWallet: '0xuser',
        nodeAddress: '0xnode',
        txHash: log.transactionHash,
        logIndex: Number(log.logIndex),
        contractAddress: log.address,
        rawPayload: { ok: true },
      };
    });

    await service.processChain({ ...CHAIN });

    expect(update).toHaveBeenCalledWith({
      where: { chain_id: BigInt(80002) },
      data: { last_synced_block: BigInt(100) },
    });
    expect(update).not.toHaveBeenCalledWith({
      where: { chain_id: BigInt(80002) },
      data: { last_synced_block: BigInt(101) },
    });
  });

  it('uses idempotent upsert key on onchain_events writes', async () => {
    const log = {
      address: CHAIN.channel_hub_address,
      blockNumber: BigInt(100),
      logIndex: 7,
      transactionHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      data: '0x',
      topics: ['0x01'],
    };

    const client = {
      getBlockNumber: jest.fn().mockResolvedValue(BigInt(100)),
      getLogs: jest.fn().mockResolvedValue([log]),
      getBlock: jest.fn().mockResolvedValue({ timestamp: BigInt(1773573035) }),
    };

    jest.spyOn(service, 'createRpcClient').mockReturnValue(client as any);
    decoderMock.filterMinedLogs.mockReturnValue([log]);
    decoderMock.groupLogsByBlock.mockReturnValue(new Map([['100', [log]]]));
    decoderMock.decodeLog.mockReturnValue({
      eventName: 'ChannelCreated',
      channelId: '0xchannel',
      userWallet: '0xuser',
      nodeAddress: '0xnode',
      txHash: log.transactionHash,
      logIndex: 7,
      contractAddress: log.address,
      rawPayload: { ok: true },
    });

    await service.processChain({ ...CHAIN });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chain_id_tx_hash_log_index: {
            chain_id: BigInt(80002),
            tx_hash: log.transactionHash,
            log_index: 7,
          },
        },
      }),
    );
  });

  it('shrinks block window after rpc error and retries smaller window', async () => {
    const client = {
      getBlockNumber: jest.fn().mockResolvedValue(BigInt(5000)),
      getLogs: jest
        .fn()
        .mockRejectedValueOnce(new Error('rpc timeout'))
        .mockResolvedValueOnce([]),
      getBlock: jest.fn(),
    };

    jest.spyOn(service, 'createRpcClient').mockReturnValue(client as any);
    decoderMock.filterMinedLogs.mockReturnValue([]);
    decoderMock.groupLogsByBlock.mockReturnValue(new Map());

    const chain = { ...CHAIN, start_block: BigInt(1) };

    await service.processChain(chain);
    await service.processChain(chain);

    const firstCall = client.getLogs.mock.calls[0][0];
    const secondCall = client.getLogs.mock.calls[1][0];

    expect(firstCall.fromBlock).toBe(BigInt(1));
    expect(firstCall.toBlock).toBe(BigInt(1500));
    expect(secondCall.fromBlock).toBe(BigInt(1));
    expect(secondCall.toBlock).toBe(BigInt(750));
  });
});
