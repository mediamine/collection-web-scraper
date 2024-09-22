import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { GroupBService } from '../group-b.service';

@Injectable()
export class TimaruHeraldService extends GroupBService {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {
    super(configService, logger);
    this.logger.setContext(TimaruHeraldService.name);
  }
}
