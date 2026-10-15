import { NestFactory } from '@nestjs/core';

jest.mock('@nestjs/core', () => ({ NestFactory: { createApplicationContext: jest.fn() } }));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('./app.service', () => ({ AppService: class AppService {} }));

const createApplicationContext = NestFactory.createApplicationContext as jest.Mock;
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// main.ts bootstraps as soon as it is imported, so each test loads a fresh copy of it. That copy gets its
// own module registry, so the AppModule and AppService it sees are handed back from inside it.
const bootstrap = async () => {
  let modules: { AppModule: unknown; AppService: unknown };
  jest.isolateModules(() => {
    require('./main');
    modules = { AppModule: jest.requireMock('./app.module').AppModule, AppService: jest.requireMock('./app.service').AppService };
  });
  await flushPromises();
  return modules;
};

describe('main', () => {
  let app: { enableShutdownHooks: jest.Mock; get: jest.Mock; close: jest.Mock };
  let scrape: jest.Mock;

  beforeEach(() => {
    scrape = jest.fn().mockResolvedValue(undefined);
    app = { enableShutdownHooks: jest.fn(), get: jest.fn(() => ({ scrape })), close: jest.fn().mockResolvedValue(undefined) };
    createApplicationContext.mockResolvedValue(app);
  });

  it('runs one scraping session in a standalone application context, then closes it', async () => {
    const { AppModule, AppService } = await bootstrap();

    expect(createApplicationContext).toHaveBeenCalledWith(AppModule);
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(app.get).toHaveBeenCalledWith(AppService);
    expect(scrape).toHaveBeenCalled();
    expect(app.close).toHaveBeenCalled();
  });

  it('closes the context only once the session has finished', async () => {
    let finishSession: () => void;
    scrape.mockReturnValue(new Promise<void>((resolve) => (finishSession = resolve)));

    await bootstrap();
    expect(app.close).not.toHaveBeenCalled();

    finishSession();
    await flushPromises();
    expect(app.close).toHaveBeenCalled();
  });

  it('serialises BigInt news item ids as strings', async () => {
    await bootstrap();

    expect(JSON.stringify({ id: BigInt('9007199254740993') })).toBe('{"id":"9007199254740993"}');
  });
});
