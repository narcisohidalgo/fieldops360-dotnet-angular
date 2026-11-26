# Phase 14 - Docker Deployment and CI/CD

> **Phase 15 audit update:** Published-image installation now
> validates the local Git revision and deployment files before
> downloading images. CI includes an isolated Administrator
> bootstrap, real Docker HTTPS authentication and structured
> test report verification. The updated Docker suite and all
> five CI/CD jobs passed in GitHub Actions run #7.
>
> The original Phase 14 deployment and delivery results
> are preserved as historical evidence.

## 1. Objectives and status

Phase 14 packages FieldOps 360 into a reproducible local
container environment and extends automated validation and
delivery through GitHub Actions.

Implemented and locally verified:

- Docker-based ASP.NET Core and Angular deployment.
- HTTPS reverse proxy with REST and SignalR support.
- Separate SQL migration and runtime credentials.
- Persistent database, certificates and Data Protection keys.
- Temporary SQL Server integration testing.
- Production Angular and Leaflet regression tests.

Implemented and verified:

- Expanded GitHub Actions validation jobs on Linux.
- Commit-versioned container publication to GHCR.
- Public access to all three published image manifests.
- Downloaded image source, revision, platform and digests.
- Fresh isolated installation and startup from published images
  on Windows with Docker Desktop and its Linux container engine.

No public hosting environment has been provisioned.

## 2. Container architecture

```mermaid
flowchart LR
    Browser["Browser"] -->|"HTTPS :8443"| Web["Nginx / Angular"]
    Web -->|"HTTP :8080 / REST / WebSockets"| API["ASP.NET Core 10"]
    API -->|"Restricted SQL account"| SQL["SQL Server 2022"]
    Migrator["EF Core migration container"] -->|"Administrative SQL account"| SQL
    SQL --> Data[("SQL data volume")]
    API --> Keys[("Data Protection volume")]
    Web --> TLS[("TLS material volume")]
```

| Service | Responsibility |
| --- | --- |
| `web` | Angular production assets, SPA routing, HTTPS and reverse proxy |
| `api` | ASP.NET Core Web API, Identity, application services and SignalR |
| `sqlserver` | SQL Server 2022 Developer Edition |
| `migrate` | One-shot EF Core schema migration service under the `tools` profile |

The API and SQL Server do not publish ports directly to the host.
Only the web service exposes `127.0.0.1:8443`.

Two Docker networks separate the web-to-API connection from
the API-to-database connection. The API trusts the explicitly
configured Nginx proxy address `172.30.240.10` for forwarded
protocol and client address information.

## 3. Docker image construction

The backend Dockerfile uses multi-stage builds:

- .NET SDK 10 for restore, build and publish.
- A migration stage containing the EF Core CLI.
- ASP.NET Core 10 runtime for normal API execution.

The frontend Dockerfile uses Node.js 24 to install dependencies
and compile Angular in production configuration. The output
is served by an unprivileged Nginx runtime image.

Local image names:

- `fieldops360-api:local`
- `fieldops360-web:local`
- `fieldops360-migrations:local`

Docker ignore files exclude local secrets, development artifacts,
test files and dependency directories where applicable.

Base image tags are version-family tags rather than fully pinned
digests. Exact binary reproducibility is therefore not guaranteed.

## 4. Initialization and startup

The following files implement environment automation:

| File | Purpose |
| --- | --- |
| `Initialize-LocalEnvironment.ps1` | Generate and validate credentials, TLS files and the TLS volume |
| `Initialize-DatabaseRuntime.ps1` | Provision and verify restricted SQL access |
| `provision-runtime.sql` | Define and verify SQL login, role and table permissions |
| `Start-LocalEnvironment.ps1` | Coordinate migrations, bootstrap, service startup and HTTPS verification |

From the repository root on Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File ./scripts/docker/Start-LocalEnvironment.ps1
```

With PowerShell 7:

```powershell
pwsh -NoProfile -File ./scripts/docker/Start-LocalEnvironment.ps1
```

The scripts are designed to preserve existing persistent resources.

Linux-specific file ownership and permission handling has been
implemented. Initialization was validated on Windows and
successfully executed on the GitHub-hosted Ubuntu runner
during the Docker validation job.

The startup process refuses to silently regenerate credentials
when an existing SQL volume requires the original password.

The first administrator is created interactively only when
no administrator exists. Existing accounts are preserved.

Administrator bootstrap temporarily uses the Development
environment in an isolated one-shot API container. The normal
application service runs in Production.

An existing environment without an active administrator requires
administrative recovery rather than automatic account replacement.

## 5. Database configuration and isolation

The containerized application uses:

- Database: `FieldOpsDockerDb`.
- SQL Server host: `sqlserver,1433` within the Docker network.
- Administrative account: `sa`, for migrations and provisioning.
- Runtime account: `fieldops_app`.
- Runtime database role: `FieldOpsRuntime`.

The normal Windows development database `FieldOpsDb`
is not used by this Docker environment.

Two independent cryptographically generated passwords are
stored locally in the ignored `.env` file.

Do not copy the placeholder values from `.env.example`.
The initialization script generates the actual credentials.

Seven EF Core migrations were verified in the local
containerized database.

The provisioning script grants SELECT, INSERT, UPDATE and DELETE
on twelve operational and Identity tables: 48 required table
permissions in total.

Access to EF Core migration history is denied to the runtime role.

Provisioning verifies effective runtime permissions, including
the absence of sysadmin, database owner, table creation and
schema alteration privileges. It also authenticates with the
actual runtime account.

These checks validate the expected application permissions,
not an exhaustive database security certification.

## 6. HTTPS and reverse-proxy configuration

Nginx terminates HTTPS on port 8443 using a locally generated
RSA 3072-bit self-signed certificate.

The certificate contains localhost and 127.0.0.1 subject
alternative names.

TLS 1.2 and TLS 1.3 are enabled. The local certificate is
generated with a validity period of 365 days.

Nginx forwards `/api` and `/hubs` to the API service.
WebSocket upgrades are supported for SignalR.

Angular client-side routes use SPA fallback to `index.html`.
The application entry point is served with a no-store cache
policy.

The API accepts forwarded headers only from its configured
trusted reverse proxy.

Production authentication and antiforgery cookies use
Secure and HttpOnly attributes and SameSite=Lax.

The initialization script verifies certificate validity,
hostname matching, key consistency and volume permissions.

Browser trust is intentionally not installed automatically.
Verify the certificate before importing it into a local
trust store.

## 7. Persistent resources and container security

| Volume | Content |
| --- | --- |
| `fieldops360_sqlserver-data` | SQL Server databases and instance state |
| `fieldops360_data-protection-keys` | ASP.NET Core Data Protection key ring |
| `fieldops360_tls-material` | Nginx certificate and private key |

The API runs as UID 1654 and Nginx as UID 101 in the
locally validated images.

Both application services drop Linux capabilities and use
no-new-privileges restrictions.

The TLS volume is mounted read-only in the web container.
The TLS private key has restricted internal permissions.

On Linux, initialization additionally restricts `.env` and
the host TLS directory and private key permissions.

On Windows, local secret files remain subject to the host
user's filesystem permissions.

Persistence was verified across container recreation.
The database records and Data Protection key material were
preserved during the local test.

Data Protection keys are persisted but are not currently
encrypted at rest by the application.

## 8. Operational commands

Show service status:

```powershell
docker compose ps
```

Stop services without removing persistent data:

```powershell
docker compose stop
```

Restart using the startup script.

Inspect service logs locally:

```powershell
docker compose logs --tail 100 api web
```

Do not publish raw environment configuration, database
credentials or private TLS keys.

The `docker compose config --quiet` command validates the
Compose configuration without displaying resolved secrets.

Deleting volumes is destructive. In particular,
`docker compose down --volumes` removes persistent local
environment data. Do not use it as a routine restart command.

The current environment has no dedicated backup, restore or
automatic certificate renewal procedure.

## 9. Automated testing

The testing architecture supports two SQL Server modes:

| Mode | Connection |
| --- | --- |
| Windows local integration | `(local)` with Windows Integrated authentication |
| Docker SQL integration | `127.0.0.1,15433` with temporary SQL credentials |

SQL-backed integration tests are enabled by
`FIELDOPS_RUN_SQL_TESTS=1`.

Real browser orchestration is enabled by
`FIELDOPS_RUN_E2E=1` and uses `FIELDOPS_E2E_ROOT`
to locate the repository.

The isolated SQL password is supplied through
`FIELDOPS_TEST_SQL_PASSWORD`.

On Linux, SQL-backed tests require that password.
The integration test database helper uses unique
`FieldOpsIntegrationTests_` database names and verifies
the expected connection configuration before migrations.

The default database-independent test command does not
enable SQL-backed or real browser tests automatically.

In CI, SQL Server runs in a temporary dedicated container.
The integration job verifies test results and checks that
temporary databases have been removed.

The container is removed in a final cleanup step.

### Production browser regression tests

The dedicated Playwright configuration is:

`src/frontend/fieldops-web/playwright.docker.config.ts`

It targets the existing HTTPS Docker frontend rather than
starting an Angular development server.

The browser is configured to accept the specifically
identified local certificate public key. Strict certificate
validation is performed separately by the HTTPS startup
and CI smoke checks.

The default local suite contains two scenarios:

- Anonymous protected-route navigation redirects to login.
- The production Leaflet bundle initializes, displays a
  facility marker and opens its popup.

The map scenario uses controlled API fixtures and mocked
external map tiles. It does not modify SQL Server.

Execute with the Docker environment already running:

```powershell
Set-Location src/frontend/fieldops-web
npm.cmd run e2e:docker
```

Frontend dependencies and Playwright Chromium must have
been installed beforehand.

The two scenarios passed during the Phase 14 local validation.

The updated CI configuration enables an additional scenario
with FIELDOPS_DOCKER_AUTH_REQUIRED=1.

CI creates a temporary Administrator in an isolated Docker
database and tests real HTTPS login, cookie security, CSRF
rejection, protected API access, session restoration and logout.

All three scenarios must pass before CI can publish images.
All three scenarios passed in GitHub Actions run #7 on 26 November 2026.

## 10. CI/CD pipeline

```mermaid
flowchart TD
    Trigger["Push / Pull request / Manual"] --> Backend["Backend validation"]
    Trigger --> Frontend["Frontend validation"]
    Trigger --> Integration["SQL integration and E2E"]
    Trigger --> Docker["Docker and production browser tests"]
    Backend --> Gate["All four jobs successful"]
    Frontend --> Gate
    Integration --> Gate
    Docker --> Gate
    Gate --> Main{"Push to main?"}
    Main -->|Yes| GHCR["Publish API, web and migration images"]
    Main -->|No| End["Validation only"]
```

### CI responsibilities

- Restore and build the backend in Release configuration.
- Run backend and frontend unit tests.
- Build the Angular production application.
- Start an isolated SQL Server container.
- Execute SQL integration and real Playwright tests.
- Validate TRX reports for at least 263 unit tests,
  43 integration tests and the native E2E coordinator.
- Validate JSON reports for at least 559 Angular tests,
  one mocked browser test, four real browser scenarios
  and three Docker browser scenarios.
- Reject failed, skipped, incomplete and flaky mandatory tests.
- Execute regression tests for the TRX and JSON validators.
- Build the three Docker application images.
- Apply migrations in the isolated Docker environment.
- Provision the restricted runtime SQL account.
- Verify HTTPS, anonymous endpoint protection and CSRF cookies.
- Verify Angular SPA routing and Leaflet production behavior.
- Remove temporary test resources.

The CI workflow is defined in `.github/workflows/ci.yml`.

### Continuous delivery

The publish job depends on all four CI jobs and is restricted
to successful pushes to `main`.

It uses `GITHUB_TOKEN` with package write permission scoped
to the delivery job.

Three Linux AMD64 images are published to:

- `ghcr.io/narcisohidalgo/fieldops360-dotnet-angular-api`
- `ghcr.io/narcisohidalgo/fieldops360-dotnet-angular-web`
- `ghcr.io/narcisohidalgo/fieldops360-dotnet-angular-migrations`

The version tag is `sha-<full-commit-sha>`.

The images contain OCI source, revision and title labels.

The registry publication step verifies that the published
image reference is accessible to the authenticated runner.

Images are rebuilt from the validated source revision.
They are not necessarily byte-identical to those used in
the Docker validation job.

The commit-based tags provide traceability but are not
cryptographically immutable. Digest pinning and signed
provenance verification are possible future improvements.

Publication of the three images is not an atomic transaction.

There is no automatic deployment to a public server.

## 11. Installation from GHCR

After a successful publication, the corresponding GHCR
packages must be accessible to the installing user.

Use the repository configuration and scripts from the
matching source revision.

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File ./scripts/docker/Start-LocalEnvironment.ps1 -PublishedCommit "<FULL_COMMIT_SHA>"
```

The installer requires Git when PublishedCommit is supplied.
The checkout HEAD must match the requested full commit SHA.
Required deployment files must be tracked and clean.
Unexpected alternative Compose and override files are rejected.

The normal local-source installation remains unchanged.

The installer downloads the API, frontend and migration
images before initializing the environment.

It verifies the OCI revision label and Linux AMD64 platform
of each downloaded image.

Application images are then reused without implicit pulls.

This validates image metadata and availability, not
cryptographic publisher authenticity.

SQL Server and auxiliary container images may still be
downloaded as needed.

The source and GHCR modes share the same local persistent
environment. Changing versions is not a validated database
downgrade or rollback procedure.

Back up important data before changing application versions.

Public access to all three image manifests was verified without
using GitHub credentials.

The published revision was downloaded and successfully started
in a fresh isolated Docker environment.

### Verified published revision

- Date: 25 November 2026.
- GitHub Actions workflow run: #4.
- Branch: `main`.
- Source commit: `13cb8c258bd09847a4e981c5d4357d4a1c045f2c`.
- Image tag: `sha-13cb8c258bd09847a4e981c5d4357d4a1c045f2c`.
- Platform: `linux/amd64`.

### Verified registry digests

| Component | Registry digest |
| --- | --- |
| API | `sha256:be57b5ec66aebf81a597fd7b9d527116a39e4256f0fb11e01f4f6ab09641363b` |
| Web | `sha256:d581ca2aa16519c3e0b5b9d3b499069cec5c3d802ae8f263902d253c1d32958b` |
| Migrations | `sha256:7ffb5c1503ce0d4a68c1b615990f9ed3f3a1ac6f8446ec7167c552bf408bffb2` |

The digests returned by the registry matched those reported
during image downloads and subsequent local image inspection.

All three downloaded images contained the expected OCI source
and revision labels and the expected Linux AMD64 platform.

These digests identify the tested publication. They do not
represent a signature or an independent security certification.

### Isolated installation verification

The installation test used a fresh GitHub clone of the exact
published revision. Only the temporary project's resource
names, proxy subnet and host HTTPS port were adapted to
allow coexistence with the existing local environment.

The original repository and deployment were not modified.

Verified installation operations:

- Download and preflight validation of all three GHCR images.
- Generation of independent SQL credentials.
- Generation and validation of new TLS material.
- Creation of isolated networks and persistent volumes.
- Fresh SQL Server database creation.
- Application of all seven EF Core migrations.
- Verification of the 48 required SQL table permissions.
- Successful restricted SQL account authentication.
- Interactive creation of the first Administrator.
- Creation or verification of the three Identity roles.
- API and Angular/Nginx container startup.
- HTTPS, reverse proxy, CSRF and anonymous access checks.
- Removal of temporary containers, networks and volumes.
- Preservation of original containers, volumes and local
  credential and TLS file fingerprints.

The temporary deployment used host HTTPS port 8444.
Application images were downloaded rather than rebuilt.

### Verification scope

The application startup from published images succeeded.

An additional post-start inspection encountered a PowerShell
5.1 native argument quoting error. The temporary environment
was cleaned up correctly.

A subsequent JSON-based image inspection verified all three
cached images, including OCI labels, platform and registry
digests.

The additional running-container image ID comparison and
final SQL row-count query were not completed because the
temporary environment had already been removed.

The seven migrations and administrator bootstrap were
independently confirmed by their successful execution logs.

This test demonstrates fresh isolated installation and
startup on an existing Docker host. It is not a completely
uncached host installation, a database upgrade test or a
public production deployment.

## 12. Validation evidence

| Verification | Status |
| --- | --- |
| Local Docker image construction | Passed |
| Local fresh isolated installation | Passed |
| Seven EF Core migrations | Passed |
| Restricted SQL account and 48 required permissions | Passed |
| Local HTTPS certificate and reverse proxy | Passed |
| Authentication and antiforgery behavior | Passed locally |
| SignalR WebSocket and real-time updates | Passed locally |
| Persistent data and key material | Passed locally |
| Non-browser integration suite using Docker SQL | 35 passed |
| Real browser coordinator using Docker SQL | Passed |
| Temporary integration database cleanup | Passed |
| Leaflet interoperability unit tests | 3 new tests passed |
| Production Playwright regression tests | 2 passed |
| CI/CD Actionlint and ShellCheck validation | Passed |
| Consolidated Phase 14 validation | Passed locally - 794 scenarios |
| Remote GitHub Actions execution | Passed - run #4, all five jobs |
| First GHCR publication | Passed - three public images |
| Installation from published GHCR images | Isolated startup passed - see verification scope |

These statuses distinguish local execution evidence from
configuration-only validation.

### Consolidated local test results

Validation date: **25 November 2026**.

| Suite | Passed |
| --- | ---: |
| .NET unit tests | 263 |
| .NET non-browser integration tests | 35 |
| Angular/Vitest unit tests | 489 |
| Playwright mocked API | 1 |
| Playwright real API and SQL Server | 4 |
| Playwright Docker production frontend | 2 |
| **Total scenarios** | **794** |

The real browser xUnit coordinator passed and is excluded
from the total to avoid counting its four browser scenarios
twice.

### Angular coverage

| Metric | Covered / Total | Coverage |
| --- | ---: | ---: |
| Lines | 3,718 / 4,102 | 90.63% |
| Branches | 1,664 / 1,934 | 86.03% |
| Functions | 530 / 629 | 84.26% |
| Statements | 4,482 / 4,932 | 90.87% |

Initial JavaScript and CSS files referenced directly by
the production index.html:

| Artifact | Raw size |
| --- | ---: |
| Main JavaScript | 371.19 kB |
| Stylesheet | 11.07 kB |
| **Total** | **382.26 kB** |

These values describe the raw build artifacts rather than
estimated compressed transfer sizes.

Backend coverage remains documented as historical Phase 13
evidence because a new backend coverage collection was not
performed during Phase 14.

The consolidated local validation completed successfully,
including the Release build, production build, temporary
SQL resources, real browser orchestration, Docker startup,
production browser regression and workflow linting.

### Remote CI/CD validation

GitHub Actions run #4 completed successfully on 25 November
2026 for commit `13cb8c258bd09847a4e981c5d4357d4a1c045f2c`.

| Job | Result | Duration |
| --- | --- | ---: |
| Backend - .NET 10 | Passed | 46 s |
| Frontend - Angular 22 | Passed | 25 s |
| Integration and E2E | Passed | 2m 29s |
| Docker - Build and HTTPS smoke tests | Passed | 2m 21s |
| CD - Publish Docker images to GHCR | Passed | 1m 37s |
| **Overall workflow** | **Success** | **4m 11s** |

The remote Vitest report confirmed 489 passing tests across
41 test files.

The delivery summary confirmed successful publication of
the API, web and migration images.

Public manifest access and isolated installation were
subsequently verified as described in Section 11.

The Phase 14 local deployment and continuous delivery
objectives are complete. Public production hosting and
additional production hardening remain outside this scope.

### Phase 15 final audit and registry verification

Validation date: **26 November 2026**.

- GitHub Actions run: **#7**.
- Source revision: `10b8529634c2a785f158d458bfdddf0a04ed671c`.
- Overall result: success, all five jobs passed.
- Workflow duration: 5 minutes and 43 seconds.
- Application test scenarios: 873 passed.
- JSON validator regression tests: 30 passed.
- TRX validator regression tests: 14 passed.
- Git revision guard checks: eight isolated scenarios passed.
- Additional negative CLI checks: three passed.
- Production Docker browser tests: three passed, including real HTTPS authentication.

All three images were verified independently through anonymous
GHCR registry requests.

Image tag: `sha-10b8529634c2a785f158d458bfdddf0a04ed671c`.

| Component | Registry digest |
| --- | --- |
| API | `sha256:f45723ee3135556953fba03455b7849ff26fdde9449298401ea83e33a63ecfdc` |
| Web | `sha256:c97868ab7bb2fa1c8f3bed4d7de287e8d2c12f892fca8a5010915e3dd1679b1d` |
| Migrations | `sha256:3e1e562d6f1ae240a1b3022150e2e00170ffae9a90518f21b9f68be576f4735f` |

The OCI source and revision labels and Linux AMD64 platform
were verified for all three images.

This revision passed the Docker CI deployment and browser tests.
An independent fresh installation from its published GHCR
images was not repeated. The earlier isolated installation
evidence remains documented in Section 11.

Registry metadata verification does not establish cryptographic
publisher authenticity.

## 13. Deployment limitations and future hardening

The current deployment is intended for local development,
demonstration and portfolio presentation.

It must not be directly exposed as a public production service.

Further work includes:

- A production hosting architecture and trusted public certificates.
- Production-licensed SQL Server or a suitable managed database.
- Verified database TLS certificates instead of
  `TrustServerCertificate=True`.
- Appropriate internal network and transport security.
- Managed secret storage and credential rotation.
- Encryption of persisted Data Protection keys.
- Dedicated API and Nginx health checks.
- Monitoring, alerting and operational observability.
- Automated backups and tested recovery procedures.
- Dependency and container vulnerability scanning.
- Digest pinning, signed provenance and deployment rollback.
- Load testing and multi-instance deployment evaluation.

SQL Server has a configured container health check.
The API and Nginx currently rely on startup checks and
explicit HTTPS smoke tests rather than dedicated Compose
health checks.

## 14. Related documentation

- [Main README](../README.md)
- [Phase 10 security design](security/phase10-security-design.md)
- [Phase 11 dashboard and GIS](phase11-dashboard-gis.md)
- [Phase 12 real-time operations](phase12-realtime.md)
- [Phase 13 testing and quality](phase13-testing-quality.md)
- [Historical Phase 12 CI configuration](ci/phase12-ci.md)
- [Database documentation](database/README.md)
