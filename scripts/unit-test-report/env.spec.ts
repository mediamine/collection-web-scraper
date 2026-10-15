import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ENV_FILES, loadEnv } from './env';

describe('loadEnv', () => {
  const originalEnv = process.env;
  let cwd: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    cwd = mkdtempSync(join(tmpdir(), 'unit-test-report-env-'));
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(cwd, { recursive: true, force: true });
  });

  it('reads the same env files as the app, in the same order', () => {
    expect(ENV_FILES).toEqual(['.env', '.env.dev', '.env.prod']);
  });

  it('takes each key from the first file that sets it, and never overrides the real environment', () => {
    writeFileSync(join(cwd, '.env'), 'REPORT_TEST_A=from .env\nREPORT_TEST_B=from .env\n');
    writeFileSync(join(cwd, '.env.dev'), 'REPORT_TEST_B=from .env.dev\nREPORT_TEST_C=from .env.dev\n');
    writeFileSync(join(cwd, '.env.prod'), 'REPORT_TEST_C=from .env.prod\nREPORT_TEST_D=from .env.prod\nREPORT_TEST_REAL=from .env.prod\n');
    process.env.REPORT_TEST_REAL = 'from the environment';

    loadEnv(cwd);

    expect(process.env).toMatchObject({
      REPORT_TEST_A: 'from .env',
      REPORT_TEST_B: 'from .env',
      REPORT_TEST_C: 'from .env.dev',
      REPORT_TEST_D: 'from .env.prod',
      REPORT_TEST_REAL: 'from the environment'
    });
  });

  it('reads the files from the working directory by default', () => {
    writeFileSync(join(cwd, '.env'), 'REPORT_TEST_A=from the working directory\n');
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);

    loadEnv();

    expect(process.env.REPORT_TEST_A).toBe('from the working directory');
  });

  it('carries on when none of the files exist', () => {
    expect(() => loadEnv(cwd)).not.toThrow();
  });
});
