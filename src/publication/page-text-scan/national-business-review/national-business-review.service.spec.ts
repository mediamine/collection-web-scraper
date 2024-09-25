import { Test, TestingModule } from '@nestjs/testing';
import { NationalBusinessReviewService } from './national-business-review.service';

describe('NationalBusinessReviewService', () => {
  let service: NationalBusinessReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NationalBusinessReviewService]
    }).compile();

    service = module.get<NationalBusinessReviewService>(NationalBusinessReviewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
