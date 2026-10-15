// The real WinstonLoggerService is transient-scoped and writes rotating files under ./logs, so specs
// inject this instead and assert on what was logged.
export const createMockLogger = () => ({
  setContext: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
  fatal: jest.fn()
});

export type MockLogger = ReturnType<typeof createMockLogger>;
