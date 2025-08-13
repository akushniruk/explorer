import { Test, TestingModule } from '@nestjs/testing';
import { NodeConfigService } from './node-config.service';

describe('NodeConfigService', () => {
  let service: NodeConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NodeConfigService],
    }).compile();

    service = module.get<NodeConfigService>(NodeConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
