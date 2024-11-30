import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { GroupCService } from '../group-c.service';

@Injectable()
export class TimaruHeraldSubscriptionService extends GroupCService {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {
    super(configService, logger);
    this.logger.setContext(TimaruHeraldSubscriptionService.name);
  }
}
