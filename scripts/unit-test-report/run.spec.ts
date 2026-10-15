import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { CoverageSummary, JestResults } from './build-card';
import { COVERAGE_SUMMARY_FILE, main, readGitInfo, readThresholds, RESULTS_FILE, runJest } from './run';

jest.mock('child_process', () => ({ spawnSync: jest.fn() }));

const spawnSyncMock = spawnSync as jest.Mock;
const WEBHOOK_URL = 'https://teams.example.invalid/workflows/unit-tests';

const passingResults = (): JestResults => ({
  startTime: 1000,
  numTotalTestSuites: 1,
  numPassedTestSuites: 1,
  numFailedTestSuites: 0,
  numTotalTests: 3,
  numPassedTests: 3,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  testResults: []
});
const coverageAt = (pct: number): CoverageSummary => ({ statements: { pct }, branches: { pct }, functions: { pct }, lines: { pct } });

describe('unit test report', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  let cwd: string;
  let fetchMock: jest.Mock;

  // Stands in for Jest (writing what a real run would) and for git
  const givenJestRun = ({
    exitCode = 0,
    results = passingResults(),
    coverage = coverageAt(99)
  }: { exitCode?: number | null; results?: JestResults | null; coverage?: CoverageSummary | null } = {}) =>
    spawnSyncMock.mockImplementation((command: string, args: Array<string>, options: { cwd: string }) => {
      if (command === 'git') return { status: 0, stdout: args.includes('--short') ? 'abc1234\n' : 'main\n' };

      if (results) writeFileSync(join(options.cwd, RESULTS_FILE), JSON.stringify(results));
      if (coverage) {
        mkdirSync(join(options.cwd, dirname(COVERAGE_SUMMARY_FILE)), { recursive: true });
        writeFileSync(join(options.cwd, COVERAGE_SUMMARY_FILE), JSON.stringify({ total: coverage }));
      }
      return { status: exitCode };
    });

  const givenEnvFile = (contents: Record<string, string>) =>
    writeFileSync(
      join(cwd, '.env'),
      Object.entries(contents)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')
    );

  const postedCard = () => JSON.parse(fetchMock.mock.calls[0][1].body).attachments[0].content;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.UNIT_TESTS_WEBHOOK_URL;
    delete process.env.UNIT_TESTS_MENTION_ON_FAILURE;
    delete process.env.UNIT_TESTS_REPORT_ENV;

    cwd = mkdtempSync(join(tmpdir(), 'unit-test-report-'));
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ jest: { coverageThreshold: { global: { lines: 95 } } } }));

    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    global.fetch = fetchMock;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    givenJestRun();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    rmSync(cwd, { recursive: true, force: true });
  });

  describe('runJest', () => {
    it('runs the suite once, with coverage, writing JSON results into the reports folder', () => {
      expect(runJest(cwd)).toBe(0);

      expect(spawnSyncMock).toHaveBeenCalledWith(
        process.execPath,
        [require.resolve('jest/bin/jest'), '--ci', '--coverage', '--json', `--outputFile=${RESULTS_FILE}`],
        { cwd, stdio: 'inherit' }
      );
      expect(existsSync(join(cwd, dirname(RESULTS_FILE)))).toBe(true);
    });

    it("clears the last run's results first", () => {
      mkdirSync(join(cwd, dirname(RESULTS_FILE)), { recursive: true });
      writeFileSync(join(cwd, RESULTS_FILE), '{}');
      mkdirSync(join(cwd, dirname(COVERAGE_SUMMARY_FILE)), { recursive: true });
      writeFileSync(join(cwd, COVERAGE_SUMMARY_FILE), '{}');
      givenJestRun({ exitCode: 1, results: null, coverage: null });

      runJest(cwd);

      expect(existsSync(join(cwd, RESULTS_FILE))).toBe(false);
      expect(existsSync(join(cwd, COVERAGE_SUMMARY_FILE))).toBe(false);
    });

    it('reports a run killed by a signal as a failure', () => {
      givenJestRun({ exitCode: null });

      expect(runJest(cwd)).toBe(1);
    });
  });

  describe('readThresholds', () => {
    it("reads the global coverage thresholds from package.json's jest config", () => {
      expect(readThresholds(cwd)).toEqual({ lines: 95 });
    });

    it('has none without them', () => {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ jest: {} }));

      expect(readThresholds(cwd)).toEqual({});
    });
  });

  describe('readGitInfo', () => {
    it('reads the short commit and the branch', () => {
      expect(readGitInfo(cwd)).toEqual({ commit: 'abc1234', branch: 'main' });
    });

    it('leaves both out outside a git checkout', () => {
      spawnSyncMock.mockReturnValue({ status: 128, stdout: '' });

      expect(readGitInfo(cwd)).toEqual({ commit: undefined, branch: undefined });
    });
  });

  describe('main', () => {
    it('posts the card to the webhook set in the env file', async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL, UNIT_TESTS_REPORT_ENV: 'prod' });

      await expect(main({ cwd, now: () => new Date('2026-10-06T18:00:00.000Z') })).resolves.toBe(0);

      expect(fetchMock).toHaveBeenCalledWith(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String)
      });
      const card = postedCard();
      expect(card.body[0].text).toBe('Unit test results: collection-web-scraper [prod]');
      expect(card.body[1].text).toBe('✅ All 3 unit tests passed');
      expect(card.body[2].facts).toEqual(
        expect.arrayContaining([
          { title: 'Run', value: 'Wed 7 Oct 2026, 7:00 am NZDT' },
          { title: 'Commit', value: 'abc1234 on main' }
        ])
      );
      expect(console.log).toHaveBeenCalledWith('✅ All 3 unit tests passed');
      expect(console.log).toHaveBeenCalledWith('Sent the unit test report to Teams.');
    });

    it("judges coverage against package.json's thresholds", async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL });
      givenJestRun({ exitCode: 1, coverage: coverageAt(80) });

      await main({ cwd });

      expect(postedCard().body[1].text).toBe('⚠️ All 3 unit tests passed, but coverage is below its threshold');
    });

    it('mentions the people in the env file when the run is not green', async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL, UNIT_TESTS_MENTION_ON_FAILURE: 'qa@example.co.nz' });
      givenJestRun({ exitCode: 1, results: null });

      await main({ cwd });

      expect(postedCard().msteams.entities).toEqual([expect.objectContaining({ text: '<at>qa@example.co.nz</at>' })]);
    });

    it("still reports, and exits with Jest's code, when the suite fails", async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL });
      givenJestRun({ exitCode: 1, results: { ...passingResults(), numFailedTests: 1, numPassedTests: 2 } });

      await expect(main({ cwd })).resolves.toBe(1);

      expect(postedCard().body[1].text).toBe('❌ 1 of 3 unit tests failed');
    });

    it('reports a run that died before writing results', async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL });
      givenJestRun({ exitCode: 1, results: null, coverage: null });

      await expect(main({ cwd })).resolves.toBe(1);

      expect(postedCard().body[1].text).toBe('❌ The unit test run did not complete (exit code 1)');
    });

    it('runs in the working directory, stamped with the current time, by default', async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL });
      jest.spyOn(process, 'cwd').mockReturnValue(cwd);

      await main();

      expect(spawnSyncMock).toHaveBeenCalledWith(process.execPath, expect.any(Array), { cwd, stdio: 'inherit' });
      expect(postedCard().body[2].facts[0]).toEqual({ title: 'Run', value: expect.stringMatching(/ NZ[DS]T$/) });
    });

    it('only prints the result when no webhook is configured', async () => {
      await expect(main({ cwd })).resolves.toBe(0);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('UNIT_TESTS_WEBHOOK_URL is not set, so the report was not sent to Teams.');
    });

    it("logs a webhook that refuses the card, keeping Jest's exit code", async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL });
      fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      await expect(main({ cwd })).resolves.toBe(0);

      expect(console.error).toHaveBeenCalledWith('Failed to send the unit test report to Teams. Teams answered 500 Internal Server Error');
    });

    it('logs a webhook it cannot reach', async () => {
      givenEnvFile({ UNIT_TESTS_WEBHOOK_URL: WEBHOOK_URL });
      fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND teams.example.invalid'));

      await expect(main({ cwd })).resolves.toBe(0);

      expect(console.error).toHaveBeenCalledWith(
        'Failed to send the unit test report to Teams. getaddrinfo ENOTFOUND teams.example.invalid'
      );
    });
  });
});
