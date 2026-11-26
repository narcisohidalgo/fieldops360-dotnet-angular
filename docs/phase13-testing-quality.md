# Phase 13 — Integration Testing and Code Quality

> **Phase 15 audit update:** The current native integration suite
> contains 43 passing non-browser tests. Angular contains 559
> passing tests across 43 files. The mocked browser test and
> four real browser scenarios also pass.
>
> The original Phase 13 coverage and results below remain
> historical. See the [main README](../README.md) for current metrics.

> **Phase 14 update:** The Phase 13 test results and coverage figures documented here are historical validation evidence. Phase 14 introduces Docker-based SQL integration testing, additional Leaflet interoperability tests and production browser regression tests. See [Phase 14 Docker and CI/CD](phase14-docker-cicd.md) for the extended strategy and current verification status.

## Overview

Phase 13 extends FieldOps 360 with automated verification
of the database, REST API, Identity security, real-time
communication and browser workflows.

It complements the existing Domain, Application and Angular
unit tests with integration and end-to-end scenarios.

Local validation date: 25 November 2026.

## Testing architecture

| Level | Technology | Scope |
| --- | --- | --- |
| Backend unit | xUnit | Domain business rules and application services |
| Persistence integration | EF Core and SQL Server | Migrations, repositories, constraints and concurrency |
| API integration | ASP.NET Core WebApplicationFactory | REST workflows, validation and persistence |
| Security integration | ASP.NET Core Identity | Authentication, cookies, CSRF, authorization and account management |
| Real-time integration | SignalR client and TestServer | Authorized event delivery and connection security |
| Frontend unit | Vitest and Angular TestBed | Components, forms, guards, services and application behavior |
| Browser E2E | Playwright and Chromium | Mocked and real browser workflows |

## Backend integration project

Location: `tests/FieldOps.Integration.Tests/`

The test project targets .NET 10 and uses xUnit,
Microsoft.AspNetCore.Mvc.Testing, Microsoft.AspNetCore.SignalR.Client
and the Coverlet data collector.

The API exposes a partial Program class to support
WebApplicationFactory hosting.

### Database isolation

Database-backed scenarios use SQL Server databases with
unique names beginning with `FieldOpsIntegrationTests_`.

The test helper connects to the local default SQL Server
instance using Windows Integrated authentication, creates
a temporary database, applies migrations where required,
and removes that database during normal cleanup.

The tests explicitly configure the temporary connection
string and validate the database identity before migrations.

They do not depend on existing application data, the
developer's administrator account or the normal FieldOpsDb
database.

Database-backed tests require explicit opt-in through
`FIELDOPS_RUN_SQL_TESTS=1`.

Database creation and deletion require appropriate SQL
Server permissions. An interrupted process can prevent
normal cleanup; temporary databases must be reviewed before
any manual removal.

The database-independent API smoke tests use an isolated
test configuration that does not require a working SQL Server.

### Sequential integration execution

Integration test collections run sequentially through
`IntegrationTestAssembly.cs`.

Parallel execution during the initial coverage run caused
SQL Server connection timeouts. After disabling parallel
execution for the integration assembly, all 35 non-browser
integration tests passed.

The unit-test assembly retains its normal parallel execution.

### Persistence and concurrency

Tests verify:

- Application of EF Core migrations to isolated SQL databases.
- Facility persistence and updates.
- Unique facility, asset, technician and work-order constraints.
- Foreign-key constraints and restricted deletion.
- Incident and work-order optimistic concurrency.
- Translation of relevant database exceptions into application exceptions.

The concurrency scenarios use separately loaded EF Core
contexts to verify conflicting writes.

This does not establish browser-level version preconditions:
HTTP If-Match and stale browser-edit protection remain
future work.

### REST API workflows

Automated integration scenarios cover Facilities, Assets,
Incidents, Technicians and Work Orders.

They verify successful mutations, retrieval, filtering,
invalid input, missing references, duplicates, forbidden
workflow transitions and persisted database state.

### Authentication and authorization

The integration suite verifies:

- Anonymous access restrictions.
- Valid login, invalid credentials and logout.
- Application cookie security attributes.
- Antiforgery token requirements.
- Role-based endpoint authorization.
- Technician access restricted to assigned work orders.
- Rejection of access to other technicians' orders.
- Administrative user creation and password reset.
- Password hashing and session invalidation.
- Account deactivation and reactivation.

Angular route guards complement, but do not replace,
server-side authorization.

### SignalR integration

The SignalR integration scenarios use authenticated
TestServer connections with Long Polling.

They verify manager-only operational notifications,
anonymous connection rejection, rejection of unsupported
client method invocations, and event delivery following
successful mutations.

Failed mutations must not produce successful change events.

The real browser suite independently exercises WebSocket
transport through the Angular development proxy.

## Browser end-to-end tests

Location: `src/frontend/fieldops-web/e2e/`

The mocked browser configuration checks that an
unauthenticated visitor is redirected to login.

The real browser configuration starts a separate
ASP.NET Core API and Angular development server, backed
by a temporary SQL Server database.

The coordinator creates test-only users, a facility,
technicians and work orders. Credentials are generated for
the isolated environment and passed to the browser process
through environment variables.

The real browser tests use:

| Service | Address |
| --- | --- |
| API | http://127.0.0.1:5091 |
| Angular | http://127.0.0.1:4292 |
| Mocked Angular E2E | http://127.0.0.1:4291 |

The coordinator verifies port availability and stops the
processes before removing the temporary database.

It uses the same build configuration as the xUnit assembly.
The final real browser validation used Release binaries
with the Development hosting environment for local HTTP.

Production cookie and transport settings are not relaxed
by this test configuration.

### Real browser scenarios

| Scenario | Behavior verified |
| --- | --- |
| Authentication | Login, return URL, session restoration and logout |
| Facility lifecycle | Administrator creation, editing, deactivation and reactivation |
| Real-time operations | WebSocket event delivery, automatic list refresh and notification actions |
| Technician workspace | Assigned-order isolation, starting and completing work, restricted navigation |

The tests use Chromium, one worker and isolated
test data. Other browser engines and production hosting
topologies are not covered by these scenarios.

## Frontend quality improvements

Phase 13 adds 35 unit tests for user creation, editing
and administrative password resets.

The tests verify invalid input, technician availability,
duplicate submission protection, HTTP error recovery,
success events and clearing password fields after
successful submission, failure or cancellation.

The notification panel was extracted into a dedicated
standalone Angular component to reduce the size of the
root application stylesheet.

A positioning correction keeps the notification panel
inside the browser viewport in the tested E2E scenario.

Leaflet is explicitly allowed as a known CommonJS
dependency. This is a targeted exception, not a global
suppression of Angular optimization warnings.

The original Angular size budgets are retained.

## Reproduce the tests

### Prerequisites

- .NET 10 SDK.
- Node.js 24 and npm compatible with the committed Angular dependencies.
- Local SQL Server default instance on Windows.
- Windows Integrated authentication with permission to create and delete test databases.
- Available ports 4291, 4292 and 5091 for the browser suites.

Use a dedicated development SQL Server environment.
Never run the test helpers against production.

Install frontend dependencies and Chromium from the
repository root:

```powershell
Push-Location src/frontend/fieldops-web
try {
    npm.cmd ci
    npx.cmd playwright install chromium
}
finally {
    Pop-Location
}
```

On Windows PowerShell, use npm.cmd and npx.cmd.
On macOS/Linux, use npm and npx. The current SQL Server
helper and real browser coordinator require the documented
local SQL Server configuration.

### Backend unit tests

From the repository root:

```powershell
dotnet test tests/FieldOps.Application.Tests/FieldOps.Application.Tests.csproj --configuration Release
```

### Backend integration tests

```powershell
$previousSql = $env:FIELDOPS_RUN_SQL_TESTS
try {
    $env:FIELDOPS_RUN_SQL_TESTS = "1"
    dotnet test tests/FieldOps.Integration.Tests/FieldOps.Integration.Tests.csproj --configuration Release --filter "FullyQualifiedName!~RealBrowserIntegrationTests"
}
finally {
    $env:FIELDOPS_RUN_SQL_TESTS = $previousSql
}
```

### Backend coverage

Coverage is collected separately for the unit and
non-browser integration projects.

```powershell
dotnet test tests/FieldOps.Application.Tests/FieldOps.Application.Tests.csproj --collect "XPlat Code Coverage"
```

```powershell
$previousSql = $env:FIELDOPS_RUN_SQL_TESTS
try {
    $env:FIELDOPS_RUN_SQL_TESTS = "1"
    dotnet test tests/FieldOps.Integration.Tests/FieldOps.Integration.Tests.csproj --collect "XPlat Code Coverage" --filter "FullyQualifiedName!~RealBrowserIntegrationTests"
}
finally {
    $env:FIELDOPS_RUN_SQL_TESTS = $previousSql
}
```

The collector produces Cobertura XML reports.
VSTest may produce identical copies when TRX attachments
are also enabled. Identical copies represent the same
coverage result.

The browser coordinator is excluded from coverage runs
because its external API process is not instrumented by
the test project's collector.

### Angular unit tests, coverage and production build

From `src/frontend/fieldops-web`:

```powershell
npm.cmd test -- --watch=false
npm.cmd run test:coverage
npm.cmd run build
```

Vitest uses the V8 coverage provider, with the installed
Vitest and provider versions aligned at 5.1.1 during
Phase 13 validation.

The coverage command generates HTML, JSON summary and
console summary reports.

### Mocked browser test

From `src/frontend/fieldops-web`:

```powershell
npm.cmd run e2e
```

### Real browser tests

From the repository root:

```powershell
$previousE2E = $env:FIELDOPS_RUN_E2E
$previousRoot = $env:FIELDOPS_E2E_ROOT

try {
    $env:FIELDOPS_RUN_E2E = "1"
    $env:FIELDOPS_E2E_ROOT = (Get-Location).Path

    dotnet test tests/FieldOps.Integration.Tests/FieldOps.Integration.Tests.csproj --configuration Release --filter "FullyQualifiedName~RealBrowserIntegrationTests" --logger "console;verbosity=detailed"
}
finally {
    $env:FIELDOPS_RUN_E2E = $previousE2E
    $env:FIELDOPS_E2E_ROOT = $previousRoot
}
```

The coordinator invokes the frontend `e2e:real` command
with its isolated API and database configuration.

Do not run `e2e:real` independently without the
required test environment.

## Validation results

Local validation completed on 25 November 2026.

| Category | Passed |
| --- | ---: |
| Backend unit | 263 |
| Backend integration (excluding browser coordinator) | 35 |
| Angular unit | 486 |
| Playwright mocked | 1 |
| Playwright real | 4 |
| **Total test scenarios** | **789** |

No selected scenarios failed or were skipped.

The .NET projects were validated in Release configuration.
The real E2E coordinator passed separately and is not
counted in addition to its four browser scenarios.

The backend validation detected no compiler warnings.
The Angular production build completed without build warnings.

Initial production bundle: 382.26 kB.
Estimated initial transfer size: 99.17 kB.

### Backend coverage

The coverage baseline was collected in Debug configuration.

| Suite | Layer | Lines | Branches |
| --- | --- | ---: | ---: |
| Unit | Domain | 98.52% | 97.91% |
| Unit | Application | 96.16% | 98.41% |
| Integration | Domain | 82.99% | 75.69% |
| Integration | Application | 93.29% | 77.77% |
| Integration | Infrastructure | 98.10% | 88.23% |
| Integration | API | 55.53% | 28.82% |

Coverage is measured independently for each suite.

Generated OpenAPI code and EF Core migration code are
included where applicable. The API percentage therefore
does not represent exclusively hand-written endpoint code.

Coverage does not by itself demonstrate correctness or
complete security. Percentages from different suites must
not be combined through simple addition or averaging.

### Angular coverage

| Metric | Covered | Total | Initial | Final |
| --- | ---: | ---: | ---: | ---: |
| Lines | 3713 | 4095 | 87.76% | 90.67% |
| Branches | 1656 | 1926 | 83.02% | 85.98% |
| Functions | 529 | 628 | 81.21% | 84.23% |
| Statements | 4477 | 4925 | 88.36% | 90.90% |

The improvement follows the addition of the 35 user
form tests. No files were manually excluded to increase
coverage percentages.

The reports are local generated artifacts and should not
be committed to the repository.

## CI scope and remaining limitations

The original Phase 13 CI baseline ran Release builds,
database-independent backend tests, Angular unit tests
and the Angular production build.

Phase 14 subsequently integrated SQL Server-backed testing
and Playwright E2E execution into GitHub Actions.

Phase 15 adds structured TRX and JSON report validation
to reject failed, skipped or incomplete mandatory suites.

No minimum coverage threshold is enforced.

The test suite does not establish production readiness,
complete penetration-test coverage, load-testing results,
cross-browser compatibility or comprehensive multi-instance
deployment behavior.

Phase 14 addresses local Docker deployment, production
configuration and extended CI/CD integration.
Final Phase 15 CI verification remains pending.

See also:

- [Project README](../README.md)
- [Security design](security/phase10-security-design.md)
- [Real-time operations](phase12-realtime.md)
- [Continuous integration](ci/phase12-ci.md)
