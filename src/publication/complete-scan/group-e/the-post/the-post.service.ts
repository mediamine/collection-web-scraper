import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ScanFnProps } from '../../../types';
import { GroupEService } from '../group-e.service';

@Injectable()
export class ThePost3Service extends GroupEService {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {
    super(configService, logger);
    this.logger.setContext(ThePost3Service.name);
  }

  async scanHome({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    await page.getByRole('button', { name: 'Toggle navigation menu' }).waitFor();

    try {
      // Create a list of all links
      const newsItems: Array<ArticleLinkProps> = ([] as Array<ArticleLinkProps>).concat(
        await this.getLinks({ page, url }, 'NZ news'),
        await this.getLinks({ page, url }, 'Politics'),
        await this.getLinks({ page, url }, 'Business'),
        // await this.getLinks({ page, url }, 'National news'),
        await this.getLinks({ page, url }, 'Culture'),
        await this.getLinks({ page, url }, 'Opinion'),
        await this.getLinks({ page, url }, 'Sport'),
        await this.getLinks({ page, url }, 'World')
        // await this.getLinks({ page, url }, 'Auckland'),

        // TODO: Decide on the following sections
        // await getLinks('Your Weekend')
        // await getLinks('Sunday')
        // await getLinks('Puzzles')
      );

      return newsItems;
    } catch (e: any) {
      console.error(e.message);
      return [];
    }
  }
}
