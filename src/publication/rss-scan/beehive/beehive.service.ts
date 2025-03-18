import { Injectable } from '@nestjs/common';
import { RssParserService } from 'src/browser/rss-parser/rss-parser.service';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ArticleProps, AuthenticateFnProps, ScanFnProps, ScannerProps } from '../../types';

@Injectable()
export class BeehiveService implements ScannerProps {
  constructor(
    private logger: WinstonLoggerService,
    private parser: RssParserService
  ) {
    this.logger.setContext(BeehiveService.name);
  }

  async authenticate({}: AuthenticateFnProps) {}

  async scanHome({ url }: ScanFnProps): Promise<Array<ArticleLinkProps>> {
    const feed = await this.parser.parseURL(url);

    return feed.items.map((item: { link: string; title: string; contentSnippet: string }) => ({
      link: item.link,
      title: item.title,
      description: item.contentSnippet
    }));
  }

  scanArticle({}: ScanFnProps): Promise<ArticleProps> {
    throw new Error('Method not implemented.');
  }

  async logout({}: AuthenticateFnProps) {}
}
