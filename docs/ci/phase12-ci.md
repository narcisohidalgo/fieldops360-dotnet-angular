# GitHub Actions Continuous Integration — Phase 14 Groundwork

This CI workflow was implemented in advance of Phase 14.
The document retains its original filename for compatibility.
Phase 12 covers SignalR and real-time operations.

## Goal

Automate build and unit-test validation for FieldOps 360.

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

The solution contains the four backend projects and
the xUnit application test project.

These tests do not require the developer's local
SQL Server instance.

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

- CI covers builds and unit tests.
- No database-backed integration tests run in CI.
- No browser end-to-end tests run in CI.
- No code coverage threshold is enforced.
- No production deployment is configured.
- Docker and automated delivery are future work.
- GitHub runner behavior must be validated with
  a real workflow execution after publication.

A successful CI run confirms the configured checks
passed; it does not establish production readiness.