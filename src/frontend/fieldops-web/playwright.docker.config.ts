import { defineConfig, devices } from '@playwright/test';
import { createHash, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const certificatePath = resolve(
  process.cwd(),
  '../../../.fieldops-local/tls/localhost.crt'
);

const certificate = new X509Certificate(
  readFileSync(certificatePath)
);

const certificatePin = createHash('sha256')
  .update(certificate.publicKey.export({
    type: 'spki',
    format: 'der'
  }))
  .digest('base64');

export default defineConfig({
  testDir: './e2e',
  // The authenticated scenario requires an isolated Docker environment.
  testMatch: process.env.FIELDOPS_DOCKER_AUTH_REQUIRED === '1'
    ? ['**/*.docker.e2e.ts', '**/*.docker-auth.e2e.ts']
    : '**/*.docker.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',

  use: {
    baseURL: 'https://localhost:8443',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium-docker',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--ignore-certificate-errors-spki-list=${certificatePin}`
          ]
        }
      }
    }
  ]
});
