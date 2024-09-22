import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { GroupBService } from '../group-b.service';

@Injectable()
export class NelsonMailService extends GroupBService {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {
    super(configService, logger);
    this.logger.setContext(NelsonMailService.name);
  }
}
