import { DateTime } from 'luxon';
import { relative } from 'path';

// The parts of Jest's --json output and of the json-summary coverage report that the card reads
export interface JestAssertionResult {
  fullName: string;
  status: string;
}

export interface JestTestFileResult {
  name: string;
  status: string;
  startTime: number;
  endTime: number;
  assertionResults: Array<JestAssertionResult>;
}

export interface JestResults {
  startTime: number;
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  testResults: Array<JestTestFileResult>;
}

export const COVERAGE_METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
export type CoverageMetric = (typeof COVERAGE_METRICS)[number];
export type CoverageSummary = Record<CoverageMetric, { pct: number }>;
export type CoverageThresholds = Partial<Record<CoverageMetric, number>>;

export interface ReportMeta {
  exitCode: number;
  runAt: Date;
  rootDir: string;
  environment?: string;
  commit?: string;
  branch?: string;
  /** Comma separated, each either an email or "Full Name <email>", as for the Playwright reporter */
  mentionOnFailure?: string;
}

export interface CardInput {
  /** Missing when Jest died before writing its results */
  results?: JestResults;
  coverage?: CoverageSummary;
  thresholds: CoverageThresholds;
  meta: ReportMeta;
}

export const MAX_LISTED_FAILURES = 10;
const TITLE = 'Unit test results: collection-web-scraper';

type Outcome = 'passed' | 'failed' | 'below-threshold' | 'incomplete';

const shortfalls = ({ coverage, thresholds }: CardInput) =>
  coverage ? COVERAGE_METRICS.filter((metric) => thresholds[metric] !== undefined && coverage[metric].pct < thresholds[metric]) : [];

const outcomeOf = (input: CardInput): Outcome => {
  const { results, meta } = input;
  if (!results) return 'incomplete';
  if (results.numFailedTests > 0 || results.numFailedTestSuites > 0) return 'failed';
  if (shortfalls(input).length > 0) return 'below-threshold';
  return meta.exitCode === 0 ? 'passed' : 'incomplete';
};

const headlineOf = (outcome: Outcome, { results, meta }: CardInput) => {
  switch (outcome) {
    case 'passed':
      return `✅ All ${results.numPassedTests} unit tests passed`;
    case 'failed':
      return results.numFailedTests > 0
        ? `❌ ${results.numFailedTests} of ${results.numTotalTests} unit tests failed`
        : `❌ ${results.numFailedTestSuites} of ${results.numTotalTestSuites} test suites failed to run`;
    case 'below-threshold':
      return `⚠️ All ${results.numPassedTests} unit tests passed, but coverage is below its threshold`;
    case 'incomplete':
      return `❌ The unit test run did not complete (exit code ${meta.exitCode})`;
  }
};

const COLORS: Record<Outcome, string> = { passed: 'Good', failed: 'Attention', 'below-threshold': 'Warning', incomplete: 'Attention' };

const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const runFacts = ({ results, meta }: CardInput) => {
  // en-NZ, or the zone renders as GMT+13 rather than NZDT
  const runAt = DateTime.fromJSDate(meta.runAt).setZone('Pacific/Auckland').setLocale('en-NZ');
  const facts = [{ title: 'Run', value: runAt.toFormat('ccc d LLL yyyy, h:mm a ZZZZ') }];
  if (meta.commit) facts.push({ title: 'Commit', value: meta.branch ? `${meta.commit} on ${meta.branch}` : meta.commit });
  if (results) {
    if (results.testResults.length > 0) {
      const finishedAt = Math.max(...results.testResults.map(({ endTime }) => endTime));
      facts.push({ title: 'Duration', value: formatDuration(finishedAt - results.startTime) });
    }
    facts.push(
      {
        title: 'Suites',
        value: `${results.numPassedTestSuites} passed, ${results.numFailedTestSuites} failed, ${results.numTotalTestSuites} total`
      },
      {
        title: 'Tests',
        value:
          `${results.numPassedTests} passed, ${results.numFailedTests} failed, ` +
          `${results.numPendingTests + results.numTodoTests} skipped, ${results.numTotalTests} total`
      }
    );
  }
  return facts;
};

const coverageBlocks = ({ coverage, thresholds }: CardInput) => {
  const heading = { type: 'TextBlock', text: 'Coverage', weight: 'Bolder', spacing: 'Medium' };
  if (!coverage) return [heading, { type: 'TextBlock', text: 'No coverage summary was written.', wrap: true, isSubtle: true }];

  const facts = COVERAGE_METRICS.map((metric) => {
    const { pct } = coverage[metric];
    const threshold = thresholds[metric];
    const title = metric[0].toUpperCase() + metric.slice(1);
    return { title, value: threshold === undefined ? `${pct}%` : `${pct}% (min ${threshold}%) ${pct >= threshold ? '✅' : '❌'}` };
  });
  return [heading, { type: 'FactSet', facts }];
};

const failureBlocks = ({ results, meta }: CardInput) => {
  if (!results) return [];

  const failures = results.testResults.flatMap(({ name, status, assertionResults }) => {
    const file = relative(meta.rootDir, name).replace(/\\/g, '/');
    const failed = assertionResults.filter((assertion) => assertion.status === 'failed');
    // A suite that fails to compile or import has no assertions of its own to list
    if (status === 'failed' && failed.length === 0) return [`- Test suite failed to run (${file})`];
    return failed.map(({ fullName }) => `- ${fullName} (${file})`);
  });
  if (failures.length === 0) return [];

  const listed = failures.slice(0, MAX_LISTED_FAILURES);
  if (failures.length > listed.length) listed.push(`- …and ${failures.length - listed.length} more`);
  return [
    { type: 'TextBlock', text: 'Failures', weight: 'Bolder', color: 'Attention', spacing: 'Medium' },
    { type: 'TextBlock', text: listed.join('\n'), wrap: true }
  ];
};

export const parseMentions = (mentionOnFailure = '') =>
  mentionOnFailure
    .split(',')
    .map((mention) => mention.trim())
    .filter(Boolean)
    .map((mention) => {
      const match = mention.match(/^(.*)<(.+)>$/);
      return match ? { name: match[1].trim() || match[2].trim(), email: match[2].trim() } : { name: mention, email: mention };
    });

export const buildUnitTestCard = (input: CardInput) => {
  const outcome = outcomeOf(input);
  const headline = headlineOf(outcome, input);
  const mentions = outcome === 'passed' ? [] : parseMentions(input.meta.mentionOnFailure);

  const content = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    // Power Automate's "post card in a chat or channel" renders up to 1.4
    version: '1.4',
    msteams: {
      width: 'Full',
      ...(mentions.length > 0 && {
        entities: mentions.map(({ name, email }) => ({ type: 'mention', text: `<at>${email}</at>`, mentioned: { id: email, name } }))
      })
    },
    body: [
      {
        type: 'TextBlock',
        text: input.meta.environment ? `${TITLE} [${input.meta.environment}]` : TITLE,
        weight: 'Bolder',
        size: 'Medium',
        wrap: true
      },
      { type: 'TextBlock', text: headline, color: COLORS[outcome], weight: 'Bolder', size: 'Large', wrap: true, spacing: 'Small' },
      { type: 'FactSet', facts: runFacts(input) },
      ...coverageBlocks(input),
      ...failureBlocks(input),
      ...(mentions.length > 0
        ? [
            {
              type: 'TextBlock',
              text: `Hi ${mentions.map(({ email }) => `<at>${email}</at>`).join(', ')}, please take a look.`,
              wrap: true
            }
          ]
        : [])
    ]
  };

  return {
    outcome,
    headline,
    // The envelope a Teams "When a Teams webhook request is received" workflow expects
    payload: {
      type: 'message',
      attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content }]
    }
  };
};
