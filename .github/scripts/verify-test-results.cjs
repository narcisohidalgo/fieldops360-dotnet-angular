'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const required = {
  browser: ['auth.browser.e2e.ts'],
  real: ['auth.real.e2e.ts', 'facilities.real.e2e.ts', 'realtime.real.e2e.ts', 'technician.real.e2e.ts'],
  docker: ['auth.docker-auth.e2e.ts', 'production.docker.e2e.ts']
};
const titles = {
  browser: ['anonymous user is redirected to login'],
  real: ['real login, session restoration and logout', 'administrator manages the facility lifecycle through Angular', 'real WebSocket updates another session and its notifications', 'technician can only access and complete assigned work orders'],
  docker: ['Docker production authenticates a real administrator over HTTPS', 'Docker production redirects anonymous users to login', 'Docker production initializes Leaflet and renders facility markers']
};

function integer(value, label, minimum = 0) {
  assert.ok(Number.isSafeInteger(value) && value >= minimum, `Invalid ${label}`);
  return value;
}

function array(value, label) {
  assert.ok(Array.isArray(value), `Missing or invalid ${label}`);
  return value;
}

function nonempty(value, label) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, `Invalid ${label}`);
  return value;
}

function verifyVitest(report) {
  assert.equal(report.success, true);
  const suites = integer(report.numTotalTestSuites, 'suite count', 1);
  assert.equal(report.numPassedTestSuites, suites);
  for (const key of ['numFailedTestSuites', 'numPendingTestSuites', 'numFailedTests', 'numPendingTests', 'numTodoTests']) {
    assert.equal(report[key], 0, key);
  }
  const total = integer(report.numTotalTests, 'test count', 559);
  assert.equal(report.numPassedTests, total);
  const files = array(report.testResults, 'testResults');
  assert.ok(files.length >= 43, 'Too few Vitest files');
  const names = new Set();
  let actual = 0;
  for (const file of files) {
    const name = nonempty(file.name, 'file name').replace(/\\/g, '/');
    assert.ok(!names.has(name), 'Duplicate Vitest file');
    names.add(name);
    assert.equal(file.status, 'passed');
    const tests = array(file.assertionResults, 'assertionResults');
    assert.ok(tests.length > 0, 'Empty Vitest file');
    for (const test of tests) {
      nonempty(test.fullName, 'test name');
      assert.equal(test.status, 'passed');
      assert.equal(array(test.failureMessages, 'failureMessages').length, 0);
      actual++;
    }
  }
  assert.equal(actual, total, 'Vitest counters disagree with individual results');
  return { tests: actual, files: files.length, suites };
}

function verifyPlaywright(report, mode) {
  assert.ok(Object.hasOwn(required, mode), 'Unknown Playwright suite');
  const project = mode === 'docker' ? 'chromium-docker' : 'chromium';
  assert.equal(array(report.errors, 'report errors').length, 0);
  const stats = report.stats;
  for (const key of ['unexpected', 'skipped', 'flaky']) {
    assert.equal(stats[key], 0, key);
  }
  const total = integer(stats.expected, 'expected count', titles[mode].length);
  const ids = new Set();
  const files = new Set();
  const seen = new Set();
  let actual = 0;
  function visit(suite) {
    for (const spec of array(suite.specs ?? [], 'specs')) {
      assert.equal(spec.ok, true);
      const file = nonempty(spec.file, 'spec file').replace(/\\/g, '/');
      const title = nonempty(spec.title, 'spec title');
      const id = nonempty(spec.id, 'spec id');
      const tests = array(spec.tests, 'spec tests');
      assert.ok(tests.length > 0, 'Empty Playwright spec');
      for (const test of tests) {
        assert.equal(test.projectName, project);
        assert.ok(!ids.has(id), 'Duplicate Playwright spec');
        ids.add(id);
        assert.equal(test.expectedStatus, 'passed');
        assert.equal(test.status, 'expected');
        const attempts = array(test.results, 'test attempts');
        assert.equal(attempts.length, 1, 'Expected one attempt');
        assert.equal(attempts[0].status, 'passed');
        assert.equal(attempts[0].retry, 0);
        assert.equal(array(attempts[0].errors, 'attempt errors').length, 0);
        files.add(file);
        seen.add(`${file}\n${title}`);
        actual++;
      }
    }
    for (const child of array(suite.suites ?? [], 'nested suites')) visit(child);
  }
  for (const suite of array(report.suites, 'suites')) visit(suite);
  assert.equal(actual, total, 'Playwright counters disagree with individual results');
  const expectedFiles = mode === 'docker' ? [required.docker[0], required.docker[1], required.docker[1]] : required[mode];
  for (let i = 0; i < titles[mode].length; i++) {
    assert.ok(seen.has(`${expectedFiles[i]}\n${titles[mode][i]}`), `Missing required ${mode} scenario ${i + 1}`);
  }
  return { tests: actual, files: files.size };
}

function verify(mode, report) {
  return mode === 'vitest' ? verifyVitest(report) : verifyPlaywright(report, mode);
}

if (require.main === module) {
  try {
    const [mode, path, ...extra] = process.argv.slice(2);
    assert.ok(['vitest', 'browser', 'real', 'docker'].includes(mode) && path && !extra.length, 'Usage: node verify-test-results.cjs <vitest|browser|real|docker> <report.json>');
    const report = JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    const result = verify(mode, report);
    console.log(`[OK] ${mode}: ${result.tests} passed tests in ${result.files} files; no skips or failures.`);
  } catch (error) {
    // Do not print report contents: E2E diagnostics may contain credentials.
    console.error(`[ERROR] Test report verification failed (${error.name}).`);
    process.exitCode = 1;
  }
}

module.exports = { verify };
