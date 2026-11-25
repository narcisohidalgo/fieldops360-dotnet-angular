# GitHub Actions Continuous Integration — Phase 14 Groundwork

> **Phase 14 update:** This document records the historical Phase 12 CI baseline. The workflow has since been extended with isolated SQL Server integration tests, Playwright, Docker deployment validation and GHCR delivery. See [Phase 14 Docker and CI/CD](../phase14-docker-cicd.md) for the current configuration and verification status.

This CI workflow was implemented in advance of Phase 14.
The document retains its original filename for compatibility.
Phase 12 covers SignalR and real-time operations.

## Goal

Automate build, unit-test and database-independent API smoke-test validation for FieldOps 360.

The project uses ASP.NET Core 10, Clean Architecture,
Angular 22, xUnit and Vitest.

CI validates the application code without deploying
the application or requiring SQL Server.

## Workflow

Path: `.github/workflows/ci.yml`

Workflow name: `FieldOps 360 CI`

Triggers:

- `push` to `main`.
- `pull_request` targeting `main`.
- `workflow_dispatch` for manual execution.

A concurrency group cancels obsolete in-progress
workflow executions for the same reference.

## Backend job

Runner: `ubuntu-latest`

Actions:

- `actions/checkout@v7`
- `actions/setup-dotnet@v6`

SDK: .NET 10.

Commands:

```bash
dotnet restore src/backend/FieldOps.slnx
dotnet build src/backend/FieldOps.slnx --configuration Release --no-restore
dotnet test src/backend/FieldOps.slnx --configuration Release --no-build --no-restore --verbosity minimal
```

The solution contains the four backend projects, the
xUnit application test project and the Phase 13
integration test project.

The default test command runs unit tests and
database-independent API smoke tests.

SQL Server-backed tests require FIELDOPS_RUN_SQL_TESTS=1.
Real browser orchestration requires FIELDOPS_RUN_E2E=1
and the additional local E2E prerequisites.

These opt-in scenarios are skipped by the current CI
configuration. The workflow does not provision SQL Server
or install Playwright browsers.

## Frontend job

Runner: `ubuntu-latest`

Actions:

- `actions/checkout@v7`
- `actions/setup-node@v7`

Node.js: 24.

Working directory:
`src/frontend/fieldops-web`

Commands:

```bash
npm ci
npm test -- --watch=false
npm run build
```

Dependencies are installed from the committed
`package-lock.json`.

The npm cache is enabled using the lockfile as
its cache dependency path.

## Security

The workflow requests:

```yaml
permissions:
  contents: read
```

Checkout does not persist Git authentication
credentials in the working directory.

CI does not require:

- Database connection strings.
- Administrator credentials.
- Application cookies.
- Authentication tokens.
- Deployment keys.
- Production environment secrets.

No migration, database update, deployment or
administrative bootstrap command is executed.

Do not add real secrets to workflow source files.

## How to inspect GitHub CI

1. Open the repository on GitHub.
2. Select the **Actions** tab.
3. Open **FieldOps 360 CI**.
4. Select the relevant workflow run.
5. Review the **Backend - .NET 10** and
   **Frontend - Angular 22** jobs.
6. Open any failed step to examine its logs.

The workflow can also be started manually
through the **Run workflow** control once
the workflow has been published on `main`.

Both jobs must pass before CI can be considered
successful for that commit.

## Local verification

Backend:

```powershell
dotnet build src/backend/FieldOps.slnx -c Release
dotnet test src/backend/FieldOps.slnx -c Release --no-build
```

Frontend (from `src/frontend/fieldops-web`):

```powershell
npm.cmd test -- --watch=false
npm.cmd run build
```

## Current scope and limitations

- CI covers builds, unit tests and database-independent API smoke tests.
- Database-backed integration tests are implemented and locally validated, but are skipped by default in CI.
- Playwright end-to-end scenarios are implemented and locally validated, but are not executed by the current workflow.
- No code coverage threshold is enforced.
- No production deployment is configured.
- Docker and automated delivery are future work.
- GitHub runner behavior must be validated with
  a real workflow execution after publication.

A successful CI run confirms the configured checks
passed; it does not establish production readiness.
