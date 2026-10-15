import { join, resolve } from 'path';
import { buildUnitTestCard, CardInput, CoverageSummary, JestResults, MAX_LISTED_FAILURES, parseMentions } from './build-card';

const ROOT = resolve('/repo');

const passingResults = (overrides: Partial<JestResults> = {}): JestResults => ({
  startTime: 1000,
  numTotalTestSuites: 2,
  numPassedTestSuites: 2,
  numFailedTestSuites: 0,
  numTotalTests: 10,
  numPassedTests: 8,
  numFailedTests: 0,
  numPendingTests: 1,
  numTodoTests: 1,
  testResults: [
    { name: join(ROOT, 'src', 'app.service.spec.ts'), status: 'passed', startTime: 1000, endTime: 30000, assertionResults: [] },
    { name: join(ROOT, 'src', 'main.spec.ts'), status: 'passed', startTime: 1000, endTime: 43400, assertionResults: [] }
  ],
  ...overrides
});

const failedTest = (file: string, fullName: string) => ({
  name: join(ROOT, ...file.split('/')),
  status: 'failed',
  startTime: 1000,
  endTime: 2000,
  assertionResults: [
    { fullName: 'a passing neighbour', status: 'passed' },
    { fullName, status: 'failed' }
  ]
});

const coverageAt = (pct: number, overrides: Partial<Record<keyof CoverageSummary, number>> = {}): CoverageSummary => ({
  statements: { pct: overrides.statements ?? pct },
  branches: { pct: overrides.branches ?? pct },
  functions: { pct: overrides.functions ?? pct },
  lines: { pct: overrides.lines ?? pct }
});

const input = (overrides: Partial<CardInput> = {}, meta: Partial<CardInput['meta']> = {}): CardInput => ({
  results: passingResults(),
  coverage: coverageAt(99),
  thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
  ...overrides,
  // 7am on Wednesday 7 October in New Zealand, during daylight saving
  meta: { exitCode: 0, runAt: new Date('2026-10-06T18:00:00.000Z'), rootDir: ROOT, ...meta }
});

// Loosely typed, as the card body is a union of block shapes
const contentOf = (cardInput: CardInput): Record<string, any> => buildUnitTestCard(cardInput).payload.attachments[0].content;
const textsOf = (cardInput: CardInput) => contentOf(cardInput).body.map((block: { text?: string }) => block.text);
const factsOf = (cardInput: CardInput) =>
  Object.fromEntries(
    contentOf(cardInput)
      .body.filter(({ type }: { type: string }) => type === 'FactSet')
      .flatMap(({ facts }: { facts: Array<{ title: string; value: string }> }) => facts.map(({ title, value }) => [title, value]))
  );
const failuresOf = (cardInput: CardInput) => {
  const texts = textsOf(cardInput);
  const index = texts.indexOf('Failures');
  return index === -1 ? undefined : texts[index + 1].split('\n');
};

describe('buildUnitTestCard', () => {
  it('wraps an Adaptive Card 1.4 in the message envelope a Teams workflow expects', () => {
    const { payload } = buildUnitTestCard(input());

    expect(payload).toEqual({
      type: 'message',
      attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: expect.any(Object) }]
    });
    expect(payload.attachments[0].content).toMatchObject({ type: 'AdaptiveCard', version: '1.4', msteams: { width: 'Full' } });
  });

  it('titles the card, naming the environment when there is one', () => {
    expect(textsOf(input())[0]).toBe('Unit test results: collection-web-scraper');
    expect(textsOf(input({}, { environment: 'prod' }))[0]).toBe('Unit test results: collection-web-scraper [prod]');
  });

  describe('headline', () => {
    it.each([
      ['every test passed', input(), 'passed', '✅ All 8 unit tests passed', 'Good'],
      [
        'tests failed',
        input(
          { results: passingResults({ numFailedTests: 2, numPassedTests: 6, numFailedTestSuites: 1, numPassedTestSuites: 1 }) },
          { exitCode: 1 }
        ),
        'failed',
        '❌ 2 of 10 unit tests failed',
        'Attention'
      ],
      [
        'a suite failed to run',
        input({ results: passingResults({ numFailedTestSuites: 1, numPassedTestSuites: 1 }) }, { exitCode: 1 }),
        'failed',
        '❌ 1 of 2 test suites failed to run',
        'Attention'
      ],
      [
        'coverage fell below a threshold',
        input({ coverage: coverageAt(99, { branches: 85 }) }, { exitCode: 1 }),
        'below-threshold',
        '⚠️ All 8 unit tests passed, but coverage is below its threshold',
        'Warning'
      ],
      [
        'Jest wrote no results',
        input({ results: undefined, coverage: undefined }, { exitCode: 1 }),
        'incomplete',
        '❌ The unit test run did not complete (exit code 1)',
        'Attention'
      ],
      [
        'Jest failed for another reason',
        input({}, { exitCode: 1 }),
        'incomplete',
        '❌ The unit test run did not complete (exit code 1)',
        'Attention'
      ]
    ])('when %s', (_, cardInput, outcome, headline, color) => {
      const card = buildUnitTestCard(cardInput);

      expect(card.outcome).toBe(outcome);
      expect(card.headline).toBe(headline);
      expect(card.payload.attachments[0].content.body[1]).toMatchObject({ text: headline, color });
    });
  });

  describe('run facts', () => {
    it('reports when, on what commit and how long the run took, with its suite and test counts', () => {
      expect(factsOf(input({}, { commit: 'abc1234', branch: 'main' }))).toMatchObject({
        Run: 'Wed 7 Oct 2026, 7:00 am NZDT',
        Commit: 'abc1234 on main',
        Duration: '42s',
        Suites: '2 passed, 0 failed, 2 total',
        Tests: '8 passed, 0 failed, 2 skipped, 10 total'
      });
    });

    it('gives a commit without its branch when the branch is unknown', () => {
      expect(factsOf(input({}, { commit: 'abc1234' })).Commit).toBe('abc1234');
    });

    it('leaves the commit out when it is unknown', () => {
      expect(factsOf(input())).not.toHaveProperty('Commit');
    });

    it('gives a run over a minute in minutes and seconds', () => {
      const results = passingResults();
      results.testResults[1].endTime = 1000 + 125400;

      expect(factsOf(input({ results })).Duration).toBe('2m 5s');
    });

    it('leaves the duration out when no suite ran', () => {
      expect(factsOf(input({ results: passingResults({ testResults: [] }) }))).not.toHaveProperty('Duration');
    });

    it('leaves the counts out when Jest wrote no results', () => {
      const facts = factsOf(input({ results: undefined }, { exitCode: 1 }));

      expect(facts).not.toHaveProperty('Suites');
      expect(facts).not.toHaveProperty('Tests');
    });
  });

  describe('coverage', () => {
    it('reports each metric against its threshold', () => {
      expect(factsOf(input({ coverage: coverageAt(99.46, { branches: 85 }) }))).toMatchObject({
        Statements: '99.46% (min 95%) ✅',
        Branches: '85% (min 90%) ❌',
        Functions: '99.46% (min 95%) ✅',
        Lines: '99.46% (min 95%) ✅'
      });
    });

    it('reports a metric without a threshold as a bare percentage', () => {
      expect(factsOf(input({ thresholds: { lines: 95 } }))).toMatchObject({ Statements: '99%', Lines: '99% (min 95%) ✅' });
    });

    it('says so when there is no coverage summary', () => {
      expect(textsOf(input({ coverage: undefined }))).toContain('No coverage summary was written.');
    });
  });

  describe('failures', () => {
    it('lists each failed test with its file', () => {
      const results = passingResults({
        numFailedTests: 1,
        testResults: [failedTest('src/app.service.spec.ts', 'AppService › logs a failed feed')]
      });

      expect(failuresOf(input({ results }, { exitCode: 1 }))).toEqual(['- AppService › logs a failed feed (src/app.service.spec.ts)']);
    });

    it('lists a suite that failed to run', () => {
      const results = passingResults({
        numFailedTestSuites: 1,
        testResults: [{ name: join(ROOT, 'src', 'broken.spec.ts'), status: 'failed', startTime: 1000, endTime: 2000, assertionResults: [] }]
      });

      expect(failuresOf(input({ results }, { exitCode: 1 }))).toEqual(['- Test suite failed to run (src/broken.spec.ts)']);
    });

    it(`lists the first ${MAX_LISTED_FAILURES} failures and counts the rest`, () => {
      const testResults = Array.from({ length: 12 }, (_, i) => failedTest(`src/spec-${i}.spec.ts`, `Test ${i}`));
      const failures = failuresOf(input({ results: passingResults({ numFailedTests: 12, testResults }) }, { exitCode: 1 }));

      expect(failures).toHaveLength(MAX_LISTED_FAILURES + 1);
      expect(failures[0]).toBe('- Test 0 (src/spec-0.spec.ts)');
      expect(failures[MAX_LISTED_FAILURES]).toBe('- …and 2 more');
    });

    it('has no failures section for a passing run', () => {
      expect(failuresOf(input())).toBeUndefined();
    });
  });

  describe('mentions', () => {
    const mentionOnFailure = 'qa@example.co.nz, Jane Doe <jane@example.co.nz>';
    const failing = (meta = {}) => input({ coverage: coverageAt(80) }, { exitCode: 1, mentionOnFailure, ...meta });

    it('mentions everyone listed when the run is not green', () => {
      const content = contentOf(failing());

      expect(content.msteams.entities).toEqual([
        { type: 'mention', text: '<at>qa@example.co.nz</at>', mentioned: { id: 'qa@example.co.nz', name: 'qa@example.co.nz' } },
        { type: 'mention', text: '<at>jane@example.co.nz</at>', mentioned: { id: 'jane@example.co.nz', name: 'Jane Doe' } }
      ]);
      expect(textsOf(failing())).toContain('Hi <at>qa@example.co.nz</at>, <at>jane@example.co.nz</at>, please take a look.');
    });

    it('mentions no one when the run is green', () => {
      const content = contentOf(input({}, { mentionOnFailure }));

      expect(content.msteams).not.toHaveProperty('entities');
      expect(textsOf(input({}, { mentionOnFailure })).join('\n')).not.toContain('<at>');
    });

    it('mentions no one when no one is listed', () => {
      expect(contentOf(failing({ mentionOnFailure: undefined })).msteams).not.toHaveProperty('entities');
    });
  });
});

describe('parseMentions', () => {
  it.each([
    [undefined, []],
    [' , ', []],
    ['qa@example.co.nz', [{ name: 'qa@example.co.nz', email: 'qa@example.co.nz' }]],
    ['Jane Doe <jane@example.co.nz>', [{ name: 'Jane Doe', email: 'jane@example.co.nz' }]],
    ['<jane@example.co.nz>', [{ name: 'jane@example.co.nz', email: 'jane@example.co.nz' }]]
  ])('parses %p', (mentionOnFailure, mentions) => {
    expect(parseMentions(mentionOnFailure)).toEqual(mentions);
  });
});
