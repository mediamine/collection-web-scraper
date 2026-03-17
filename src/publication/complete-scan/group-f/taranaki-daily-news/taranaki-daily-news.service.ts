import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { GroupFService } from '../group-f.service';

@Injectable()
export class TaranakiDailyNewsSubscription2Service extends GroupFService {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {
    super(configService, logger);
    this.logger.setContext(TaranakiDailyNewsSubscription2Service.name);
  }
}
