import { spawnSync } from 'child_process';
import { mkdirSync, readFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { buildUnitTestCard, CoverageSummary, CoverageThresholds, JestResults } from './build-card';
import { loadEnv } from './env';

// Runs the Jest unit suite once and posts the outcome to a Teams channel. The webhook comes from
// UNIT_TESTS_WEBHOOK_URL in the env files; without it the run still happens and is only printed. Exits with
// Jest's own exit code, so a failing suite still fails whatever invoked this.
//
// A Jest reporter can't do this job: Jest runs custom reporters before its coverage reporter, so coverage
// isn't available to them yet.

export const RESULTS_FILE = 'reports/unit-tests/jest-results.json';
export const COVERAGE_SUMMARY_FILE = 'coverage/coverage-summary.json';

const readJson = <T>(file: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

export const runJest = (cwd: string): number => {
  // Clear the last run's files, so a run that dies early can't be reported with stale results
  rmSync(join(cwd, RESULTS_FILE), { force: true });
  rmSync(join(cwd, COVERAGE_SUMMARY_FILE), { force: true });
  mkdirSync(join(cwd, dirname(RESULTS_FILE)), { recursive: true });

  const { status } = spawnSync(
    process.execPath,
    [require.resolve('jest/bin/jest'), '--ci', '--coverage', '--json', `--outputFile=${RESULTS_FILE}`],
    {
      cwd,
      stdio: 'inherit'
    }
  );
  return status ?? 1;
};

export const readThresholds = (cwd: string): CoverageThresholds =>
  readJson<{ jest?: { coverageThreshold?: { global?: CoverageThresholds } } }>(join(cwd, 'package.json'))?.jest?.coverageThreshold
    ?.global ?? {};

const git = (cwd: string, ...args: Array<string>) => {
  const { status, stdout } = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return status === 0 ? stdout.trim() : undefined;
};

export const readGitInfo = (cwd: string) => ({
  commit: git(cwd, 'rev-parse', '--short', 'HEAD'),
  branch: git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')
});

export const postToTeams = async (webhookUrl: string, payload: unknown) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Teams answered ${response.status} ${response.statusText}`);
  }
};

export const main = async ({ cwd = process.cwd(), now = () => new Date() }: { cwd?: string; now?: () => Date } = {}) => {
  loadEnv(cwd);

  const runAt = now();
  const exitCode = runJest(cwd);

  const { headline, payload } = buildUnitTestCard({
    results: readJson<JestResults>(join(cwd, RESULTS_FILE)),
    coverage: readJson<{ total: CoverageSummary }>(join(cwd, COVERAGE_SUMMARY_FILE))?.total,
    thresholds: readThresholds(cwd),
    meta: {
      exitCode,
      runAt,
      rootDir: cwd,
      environment: process.env.UNIT_TESTS_REPORT_ENV,
      mentionOnFailure: process.env.UNIT_TESTS_MENTION_ON_FAILURE,
      ...readGitInfo(cwd)
    }
  });
  console.log(headline);

  const webhookUrl = process.env.UNIT_TESTS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('UNIT_TESTS_WEBHOOK_URL is not set, so the report was not sent to Teams.');
    return exitCode;
  }

  try {
    await postToTeams(webhookUrl, payload);
    console.log('Sent the unit test report to Teams.');
  } catch (e) {
    // A Teams outage shouldn't be mistaken for a failing suite, so the exit code stays Jest's
    console.error(`Failed to send the unit test report to Teams. ${e.message}`);
  }
  return exitCode;
};

/* istanbul ignore next -- the entry point, run by `yarn test:report` */
if (require.main === module) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
