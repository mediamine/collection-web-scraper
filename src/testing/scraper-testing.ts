import { Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { WinstonLoggerService } from 'src/logger';
import { ArticleLinkProps, ScanFnProps } from 'src/publication/types';
import { createMockConfig } from './mock-config';
import { createMockLogger } from './mock-logger';
import { createMockPage, MockPage } from './mock-playwright';

export const TEST_URL = 'https://www.example.co.nz';

// Resolves the service through real Nest DI, so a missing @Injectable or a changed constructor still fails,
// with ConfigService and WinstonLoggerService swapped for mocks. Any other dependency goes in `providers`.
export const createServiceModule = async <T>(
  Service: Type<T>,
  { config = {}, providers = [] }: { config?: Record<string, string>; providers?: Provider[] } = {}
) => {
  const logger = createMockLogger();
  const configService = createMockConfig(config);
  const moduleRef = await Test.createTestingModule({
    providers: [
      Service,
      { provide: ConfigService, useValue: configService },
      { provide: WinstonLoggerService, useValue: logger },
      ...providers
    ]
  }).compile();

  return { service: moduleRef.get(Service), logger, configService, moduleRef };
};

interface SectionScraper {
  scanHome(props: ScanFnProps): Promise<Array<ArticleLinkProps>>;
  getLinks(props: ScanFnProps, section: string): Promise<Array<ArticleLinkProps>>;
}

const linkFor = (section: string): ArticleLinkProps => ({ link: `${TEST_URL}/${section}`, title: section, description: '' });

// The publication subclasses that only override scanHome with the list of sections to visit. The group base
// class owns getLinks and is tested on its own, so it is stubbed out here.
export const describeSectionScraper = (
  Service: Type<SectionScraper>,
  Base: Type<unknown>,
  { anchor, sections }: { anchor: string; sections: Array<string> }
) =>
  describe(Service.name, () => {
    let service: SectionScraper;
    let logger: ReturnType<typeof createMockLogger>;
    let page: MockPage;
    let getLinks: jest.SpyInstance;

    beforeEach(async () => {
      ({ service, logger } = await createServiceModule(Service));
      page = createMockPage();
      getLinks = jest.spyOn(service, 'getLinks').mockImplementation(async (_props, section) => [linkFor(section)]);
    });

    const failOn = (failingSection: string) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      getLinks.mockImplementation(async (_props, section) => {
        if (section === failingSection) throw new Error(`No such section: ${section}`);
        return [linkFor(section)];
      });
    };

    it(`extends ${Base.name}`, () => {
      expect(service).toBeInstanceOf(Base);
    });

    it('sets its logger context', () => {
      expect(logger.setContext).toHaveBeenCalledWith(Service.name);
    });

    it('waits for the home page, then collects every section in order', async () => {
      const links = await service.scanHome({ page, url: TEST_URL });

      expect(page.locatorFor(anchor).waitFor).toHaveBeenCalled();
      expect(getLinks.mock.calls).toEqual(sections.map((section) => [{ page, url: TEST_URL }, section]));
      expect(links).toEqual(sections.map(linkFor));
    });

    it('propagates a home page that never loads, before visiting any section', async () => {
      page.locatorFor(anchor).waitFor.mockRejectedValue(new Error('Timeout 60000ms exceeded'));

      await expect(service.scanHome({ page, url: TEST_URL })).rejects.toThrow('Timeout 60000ms exceeded');
      expect(getLinks).not.toHaveBeenCalled();
    });

    it('returns no links when a section fails', async () => {
      failOn(sections[sections.length - 1]);

      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual([]);
      expect(console.error).toHaveBeenCalledWith(`No such section: ${sections[sections.length - 1]}`);
    });

    // Known defect: one section that fails to load throws away the links every other section returned
    it.failing('keeps the links from the sections that loaded when one section fails', async () => {
      failOn(sections[sections.length - 1]);

      await expect(service.scanHome({ page, url: TEST_URL })).resolves.toEqual(sections.slice(0, -1).map(linkFor));
    });

    // Known defect: the failure goes to console.error, so it never reaches the rotated log files
    it.failing('reports a failed section through the logger', async () => {
      failOn(sections[0]);

      await service.scanHome({ page, url: TEST_URL });
      expect(logger.error).toHaveBeenCalled();
    });
  });

// The per-publication subclasses that add nothing to their group but a logger context: all of their behaviour
// is the group base class's, which has its own spec.
export const describeEmptySubclass = (Service: Type<unknown>, Base: Type<unknown>) =>
  describe(Service.name, () => {
    it(`is a ${Base.name} with its own logger context`, async () => {
      const { service, logger } = await createServiceModule(Service);

      expect(service).toBeInstanceOf(Base);
      expect(logger.setContext).toHaveBeenCalledWith(Service.name);
    });

    it(`adds no behaviour of its own to ${Base.name}`, () => {
      // Overriding a method here means this publication needs a spec of its own
      expect(Object.getOwnPropertyNames(Service.prototype)).toEqual(['constructor']);
    });
  });
