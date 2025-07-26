import { Test, TestingModule } from '@nestjs/testing';
import { YellowApiService } from './yellow-api.service';

describe('YellowApiService', () => {
  let service: YellowApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YellowApiService],
    }).compile();

    service = module.get<YellowApiService>(YellowApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
