import { Test, TestingModule } from '@nestjs/testing';
import { RssParserService } from './rss-parser.service';

describe('RssParserService', () => {
  let service: RssParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RssParserService]
    }).compile();

    service = module.get<RssParserService>(RssParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
