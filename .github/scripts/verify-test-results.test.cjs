'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verify } = require('./verify-test-results.cjs');

function vitestReport() {
  return {
    success: true, numTotalTestSuites: 87, numPassedTestSuites: 87,
    numFailedTestSuites: 0, numPendingTestSuites: 0,
    numTotalTests: 559, numPassedTests: 559, numFailedTests: 0,
    numPendingTests: 0, numTodoTests: 0,
    testResults: Array.from({ length: 43 }, (_, i) => ({
      name: `src/test-${i}.spec.ts`, status: 'passed',
      assertionResults: Array.from({ length: 13 }, () => ({
        fullName: 'parameterized example', status: 'passed', failureMessages: []
      }))
    }))
  };
}

function playwrightReport(mode) {
  const cases = {
    browser: [['auth.browser.e2e.ts', 'anonymous user is redirected to login']],
    real: [
      ['auth.real.e2e.ts', 'real login, session restoration and logout'],
      ['facilities.real.e2e.ts', 'administrator manages the facility lifecycle through Angular'],
      ['realtime.real.e2e.ts', 'real WebSocket updates another session and its notifications'],
      ['technician.real.e2e.ts', 'technician can only access and complete assigned work orders']
    ],
    docker: [
      ['auth.docker-auth.e2e.ts', 'Docker production authenticates a real administrator over HTTPS'],
      ['production.docker.e2e.ts', 'Docker production redirects anonymous users to login'],
      ['production.docker.e2e.ts', 'Docker production initializes Leaflet and renders facility markers']
    ]
  }[mode];
  return {
    errors: [], stats: { expected: cases.length, unexpected: 0, skipped: 0, flaky: 0 },
    suites: [{ suites: [{ specs: cases.map(([file, title], i) => ({
      file, title, id: `spec-${i}`, ok: true,
      tests: [{ projectName: mode === 'docker' ? 'chromium-docker' : 'chromium',
        expectedStatus: 'passed', status: 'expected',
        results: [{ status: 'passed', retry: 0, errors: [] }] }]
    })) }] }]
  };
}

const specs = r => r.suites[0].suites[0].specs;
const attempt = r => specs(r)[0].tests[0].results[0];

test('accepts 559 Vitest tests, including repeated titles', () => {
  assert.deepEqual(verify('vitest', vitestReport()), { tests: 559, files: 43, suites: 87 });
});
for (const [name, mutate] of [
  ['missing counter', r => delete r.numTodoTests],
  ['pending test', r => { r.numPendingTests = 1; }],
  ['todo test', r => { r.numTodoTests = 1; }],
  ['failed test', r => { r.numFailedTests = 1; }],
  ['failed suite', r => { r.numFailedTestSuites = 1; }],
  ['missing individual test', r => r.testResults[0].assertionResults.pop()],
  ['individual skipped test', r => { r.testResults[0].assertionResults[0].status = 'skipped'; }],
  ['duplicate file', r => { r.testResults[1].name = r.testResults[0].name; }],
  ['below baseline with consistent counters', r => { r.testResults[0].assertionResults.pop(); r.numTotalTests--; r.numPassedTests--; }],
  ['too few files with unchanged test count', r => { r.testResults[0].assertionResults.push(...r.testResults.pop().assertionResults); }]
]) test(`rejects Vitest ${name}`, () => {
  const report = vitestReport(); mutate(report);
  assert.throws(() => verify('vitest', report));
});

for (const [mode, count] of [['browser', 1], ['real', 4], ['docker', 3]]) {
  test(`accepts ${mode} Playwright suite`, () => {
    assert.equal(verify(mode, playwrightReport(mode)).tests, count);
  });
}
for (const [name, mutate] of [
  ['missing required scenario', r => { specs(r)[0].title = 'replacement scenario'; }],
  ['missing counter', r => delete r.stats.skipped],
  ['global error', r => r.errors.push({ message: 'synthetic failure' })],
  ['skipped scenario', r => { r.stats.skipped = 1; }],
  ['flaky scenario', r => { r.stats.flaky = 1; }],
  ['unexpected scenario', r => { r.stats.unexpected = 1; }],
  ['expected failure', r => { specs(r)[0].tests[0].expectedStatus = 'failed'; }],
  ['interrupted attempt', r => { attempt(r).status = 'interrupted'; }],
  ['no attempts', r => { specs(r)[0].tests[0].results = []; }],
  ['extra attempt', r => { specs(r)[0].tests[0].results.push(structuredClone(attempt(r))); }],
  ['retry', r => { attempt(r).retry = 1; }],
  ['attempt error', r => attempt(r).errors.push({ message: 'synthetic error' })],
  ['duplicate spec', r => { specs(r)[1].id = specs(r)[0].id; }],
  ['wrong project', r => { specs(r)[0].tests[0].projectName = 'chromium'; }],
  ['counter mismatch', r => { r.stats.expected++; }],
  ['two Docker tests without authentication', r => { specs(r).shift(); r.stats.expected--; }]
]) test(`rejects Playwright ${name}`, () => {
  const report = playwrightReport('docker'); mutate(report);
  assert.throws(() => verify('docker', report));
});
