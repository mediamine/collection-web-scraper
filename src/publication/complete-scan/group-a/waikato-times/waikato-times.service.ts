import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ScanFnProps, ScannerProps } from '../../../types';
import { GroupAService } from '../group-a.service';

@Injectable()
export class WaikatoTimesService extends GroupAService implements ScannerProps {
  constructor(
    protected configService: ConfigService,
    protected logger: WinstonLoggerService
  ) {
    super(configService, logger);
    this.logger.setContext(WaikatoTimesService.name);
  }

  async scanHome({ page, url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    await page.locator('#mastheads_menu').waitFor();

    try {
      // Create a list of all links
      const newsItems: Array<ArticleLinkProps> = ([] as Array<ArticleLinkProps>).concat(
        await this.getLinks({ page, url }, 'News'),
        await this.getLinks({ page, url }, 'Life'),
        await this.getLinks({ page, url }, 'Politics'),
        await this.getLinks({ page, url }, 'Business'),
        await this.getLinks({ page, url }, 'History'),
        await this.getLinks({ page, url }, 'World news'),
        await this.getLinks({ page, url }, 'Sport')

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
