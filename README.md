# FieldOps 360

**Enterprise Operations & Maintenance Management Platform**

FieldOps 360 is a full-stack portfolio project for managing facilities, their equipment, operational incidents, technicians and work orders. The backend uses ASP.NET Core 10 and Entity Framework Core with SQL Server; the frontend uses Angular 22.

> **Project status:** Phases 1-12 implemented and technically validated for local development and portfolio demonstration. Facilities, Assets, Incidents, Technicians, Work Orders, ASP.NET Core Identity authentication, role-based authorization and user management are implemented. Production deployment hardening and further integration testing remain future work.

## Technology stack

| Layer | Technology |
| --- | --- |
| Backend | ASP.NET Core 10 Web API, C#, ASP.NET Core Identity |
| Frontend | Angular 22, TypeScript, standalone components, reactive forms, template-driven login, signals |
| Persistence | SQL Server, Entity Framework Core 10, migrations |
| Architecture | Clean Architecture (Domain, Application, Infrastructure, API) |
| Tests | xUnit (.NET), Vitest (Angular) |
| Dashboard and GIS | Angular signals, CSS charts, Leaflet 1.9.4, OpenStreetMap tiles |
| Real-time operations | ASP.NET Core SignalR, `@microsoft/signalr` 10.0.11, RxJS |

## Implemented features

### Authentication and authorization (Phase 10)

- Authenticate users through ASP.NET Core Identity with an HttpOnly application cookie.
- Protect state-changing API requests with antiforgery tokens and the `X-XSRF-TOKEN` header.
- Restore browser sessions with `GET /api/auth/me`.
- Provide login, logout, access-denied and role-aware Angular navigation.
- Apply server-side role policies to operational and administrative endpoints.
- Manage accounts, activation, deactivation, roles and administrative password resets.
- Prevent deactivation or demotion of the last active Administrator.
- Link Technician-role accounts to active technician records.
- Restrict technicians to their own assigned work orders.
- Apply password requirements, account lockout and security-stamp validation.
- Keep credentials out of source control; public self-registration is disabled.

| Role | Main permissions |
| --- | --- |
| Administrator | Manage facilities, assets, incidents, technicians, work orders and user accounts |
| Supervisor | Read facilities; manage assets, incidents, technicians and work orders |
| Technician | Read facilities and assets; view, start and complete assigned work orders |

Authorization is enforced by the API. Angular route guards provide navigation control but are not the security boundary.

See [Phase 10 security design](docs/security/phase10-security-design.md) for implementation details, verification and remaining hardening work.

### Operational dashboard and GIS (Phase 11)

- View operational KPIs for facilities, assets, technicians, incidents and work orders.
- Display incident and work-order status distributions with responsive charts.
- Monitor overdue and unassigned planned work orders.
- Refresh indicators using authenticated `GET /api/dashboard/summary`.
- Restrict dashboard access to Administrator and Supervisor.
- Record optional geographic coordinates for facilities.
- Validate coordinate ranges and require latitude and longitude together.
- Display geolocated facilities on an interactive Leaflet map.
- Differentiate active and inactive facilities with colored markers.
- Show facility information in map popups.
- Report facilities without coordinates instead of inventing locations.

See [Phase 11 technical documentation](docs/phase11-dashboard-gis.md)
for implementation details, verification and limitations.

### Real-time operations and notifications (Phase 12)

- Broadcast generic work-order and incident change events with ASP.NET Core SignalR.
- Refresh authorized Angular lists while preserving the current filters.
- Automatically refresh dashboard KPIs and status charts.
- Show in-memory operational notifications for Administrator and Supervisor.
- Support unread counts, notification actions and navigation to the relevant module.
- Recover SignalR connections after failures, without creating false notifications.
- Continue using REST authorization as the source of truth for operational data.
- Keep SignalR notifications free of private entity payloads.
- Require no additional SQL Server tables or migrations.

See [Phase 12 technical documentation](docs/phase12-realtime.md)
for architecture, security, verification and limitations.
### Facilities

- List facilities and retrieve an individual facility.
- Create and update facilities with validation and unique facility codes.
- Activate or deactivate facilities without deleting their records.
- Store optional latitude and longitude, editable through the Angular forms and available through the REST API.

### Assets

- List assets, retrieve details and filter by facility.
- Create assets linked to an existing facility, validating a unique code within that facility.
- Update asset details; activate and deactivate without deleting records.
- Show facility information within the Angular UI.

### Incidents

- Create incidents linked to an existing facility, with an optional asset that must belong to the same facility.
- Query incidents individually or filter the list by facility, asset, status and priority.
- Edit title, description and priority while an incident is **Open** or **InProgress**.
- Manage the workflow **Open → InProgress → Resolved → Closed**, with reopening from **Resolved** or **Closed** to **Open**.
- Record creation, last update, resolution and closure timestamps (UTC), with resolution/closure timestamps cleared on reopening.
- Use Angular forms, filter selectors, confirmation dialogs/panels, feedback messages and error handling.

Incident priorities: `Low` (1), `Medium` (2), `High` (3), `Critical` (4). Statuses: `Open` (1), `InProgress` (2), `Resolved` (3), `Closed` (4).

### Technicians

- List technicians and retrieve their details.
- Create technicians with unique codes, required names and validated email addresses.
- Store optional phone numbers and specialties.
- Update technician details without changing their codes.
- Activate and deactivate technicians without deleting their records.
- Manage technicians through Angular reactive forms, confirmation panels and error handling.
- Assign and unassign active technicians to planned work orders.

### Work orders

- Create work orders with a unique code, title, optional description and priority.
- Link each order to an existing facility, with optional asset, incident and technician references.
- Validate facility/asset/incident consistency and require an active technician when assigning or starting work.
- Retrieve individual orders and filter lists by facility, asset, incident, technician, status and priority.
- Edit work order details and planned dates only while the order is **Planned**.
- Assign or unassign technicians while an order is **Planned**.
- Manage the workflow **Planned → InProgress → Completed**, with cancellation available from **Planned** or **InProgress**.
- Require a cancellation reason and prevent changes to completed or cancelled orders.
- Record creation, update, start, completion and cancellation timestamps in UTC.
- Use Angular reactive forms, filter selectors, confirmation panels and error handling.
- Preserve the original precision of unchanged scheduled dates when saving edits.
- Enforce unique work order codes in SQL Server, with HTTP 409 Conflict for duplicates.

Priorities: `Low` (1), `Medium` (2), `High` (3), `Critical` (4). Statuses: `Planned` (1), `InProgress` (2), `Completed` (3), `Cancelled` (4).

### Technician workspace

- Display work orders assigned to the authenticated technician.
- Read only orders linked to the technician identity stored on the server.
- Start and complete eligible assigned orders.
- Reject unauthorized access to other technicians' work orders.
- Apply optimistic concurrency checks to work order status changes.

### Optimistic concurrency

SQL Server `rowversion` is configured as an EF Core concurrency token for incidents and work orders. Conflicting writes using the same previously loaded database version can be detected, with HTTP 409 Conflict returned by the API.

The browser does not yet transmit an explicit version precondition such as HTTP `If-Match`. Consequently, the application does not guarantee detection of stale edits from separately opened browser sessions. Client-side version preconditions remain future work.

## Architecture

```text
src/
  backend/
    FieldOps.Domain/           # Entities and business rules
    FieldOps.Application/      # Use cases, DTOs, persistence contracts
    FieldOps.Infrastructure/   # EF Core, repositories and migrations
    FieldOps.Api/              # REST controllers and dependency injection
  frontend/
    fieldops-web/              # Angular 22 application
tests/
  FieldOps.Application.Tests/  # xUnit tests
docs/
  ci/                          # GitHub Actions CI documentation
  database/                    # SQL database documentation
  security/                    # Authentication, authorization and security
  phase11-dashboard-gis.md     # Dashboard, KPIs, geolocation and map
  phase12-realtime.md          # SignalR, notifications and live dashboard
```

The frontend uses feature-based folders under `src/app/features/`, Angular `HttpClient` services and lazy-loaded routes.

## Main REST endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Obtain an antiforgery request token |
| POST | `/api/auth/login` | Authenticate and establish a cookie session |
| POST | `/api/auth/logout` | End the authenticated session |
| GET | `/api/auth/me` | Retrieve the current authenticated user |
| GET | `/api/users` | List managed accounts (Administrator) |
| GET | `/api/users/{id}` | Retrieve a managed account (Administrator) |
| POST | `/api/users` | Create an account (Administrator) |
| PUT | `/api/users/{id}` | Update an account (Administrator) |
| PATCH | `/api/users/{id}/activate` | Activate an account (Administrator) |
| PATCH | `/api/users/{id}/deactivate` | Deactivate an account (Administrator) |
| POST | `/api/users/{id}/reset-password` | Reset an account password (Administrator) |
| GET | `/api/my/work-orders` | List the authenticated technician's orders |
| GET | `/api/my/work-orders/{id}` | Retrieve an assigned work order |
| PATCH | `/api/my/work-orders/{id}/start` | Start an assigned work order |
| PATCH | `/api/my/work-orders/{id}/complete` | Complete an assigned work order |
| GET | `/api/dashboard/summary` | Operational KPIs (Administrator/Supervisor) |
| GET | `/api/facilities` | List facilities, including optional coordinates |
| GET | `/api/facilities/{id}` | Retrieve facility details and coordinates |
| POST | `/api/facilities` | Create a facility (Administrator) |
| PUT | `/api/facilities/{id}` | Update facility details and coordinates (Administrator) |
| PATCH | `/api/facilities/{id}/activate` | Activate a facility (Administrator) |
| PATCH | `/api/facilities/{id}/deactivate` | Deactivate a facility (Administrator) |
| GET | `/api/assets` | List assets; optional `facilityId` filter |
| GET | `/api/incidents` | List incidents; optional `facilityId`, `assetId`, `status`, `priority` filters |
| GET | `/api/incidents/{id}` | Retrieve an incident |
| POST | `/api/incidents` | Create an incident |
| PUT | `/api/incidents/{id}` | Edit permitted incident details |
| PATCH | `/api/incidents/{id}/start` | Open → InProgress |
| PATCH | `/api/incidents/{id}/resolve` | InProgress → Resolved |
| PATCH | `/api/incidents/{id}/close` | Resolved → Closed |
| PATCH | `/api/incidents/{id}/reopen` | Resolved/Closed → Open |
| GET | `/api/technicians` | List technicians |
| GET | `/api/technicians/{id}` | Retrieve a technician |
| POST | `/api/technicians` | Create a technician |
| PUT | `/api/technicians/{id}` | Update technician details |
| PATCH | `/api/technicians/{id}/activate` | Activate a technician |
| PATCH | `/api/technicians/{id}/deactivate` | Deactivate a technician |
| GET | `/api/work-orders` | List orders; optional `facilityId`, `assetId`, `incidentId`, `technicianId`, `status`, `priority` filters |
| GET | `/api/work-orders/{id}` | Retrieve a work order |
| POST | `/api/work-orders` | Create a work order |
| PUT | `/api/work-orders/{id}` | Edit permitted planned-order details |
| PATCH | `/api/work-orders/{id}/assign-technician` | Assign or unassign a technician |
| PATCH | `/api/work-orders/{id}/start` | Planned → InProgress |
| PATCH | `/api/work-orders/{id}/complete` | InProgress → Completed |
| PATCH | `/api/work-orders/{id}/cancel` | Planned/InProgress → Cancelled |

The Facilities and Assets controllers also provide their own create, update and activation/deactivation operations.

## Continuous integration (Phase 14 groundwork)

GitHub Actions is configured in `.github/workflows/ci.yml`
to check the backend and frontend independently.

The workflow runs on:

- Pushes to `main`.
- Pull requests targeting `main`.
- Manual execution through GitHub Actions.

Two independent jobs run on Ubuntu:

| Job | Validation |
| --- | --- |
| Backend (.NET 10) | Restore, Release build, xUnit tests |
| Frontend (Angular 22) | `npm ci`, Vitest tests, production build |

The workflow uses read-only repository permissions and
does not require SQL Server, application credentials
or production secrets.

It performs continuous integration checks only.
It does not deploy the application, apply migrations
or modify a database.

See [CI documentation](docs/ci/phase12-ci.md)
for configuration, verification instructions and limitations.
## Local development

### Requirements

- .NET 10 SDK and the `dotnet-ef` tool for EF Core migrations.
- Node.js/npm compatible with Angular 22.
- SQL Server accessible from the development machine.

### 1. Configure the SQL Server connection

Configure the connection string **locally using .NET User Secrets**. From the repository root in PowerShell:

```powershell
dotnet user-secrets set "ConnectionStrings:FieldOpsDb" "Server=(local);Database=FieldOpsDb;Integrated Security=True;TrustServerCertificate=True;Encrypt=False;Pooling=False;Connection Timeout=15" --project src/backend/FieldOps.Api/FieldOps.Api.csproj
```

This example uses the local default SQL Server instance with Windows Integrated authentication. `Encrypt=False` is intended only for this local development setup; production deployments require secure transport and appropriate certificates. Adjust the server configuration for your environment. Never commit database credentials or tokens.

### 2. Apply Entity Framework Core migrations

Run from the repository root:

```powershell
dotnet ef database update --project src/backend/FieldOps.Infrastructure/FieldOps.Infrastructure.csproj --startup-project src/backend/FieldOps.Api/FieldOps.Api.csproj --context FieldOpsDbContext
```

This applies all available migrations, including `InitialCreate`, `AddIncidents`, `AddIncidentRowVersion`, `AddTechnicians`, `AddWorkOrders` and `AddIdentitySecurity` and `AddFacilityCoordinates`, as needed. The file `docs/database/InitialCreate.sql` represents **only the initial schema**, not the complete current schema; see [Database documentation](docs/database/README.md).

### 3. Bootstrap the first administrator (new databases only)

After applying the Identity migration, create the first Administrator from an interactive terminal:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project src/backend/FieldOps.Api/FieldOps.Api.csproj --no-launch-profile -- --bootstrap-admin
```

Enter the display name, email and password when prompted. Password entry is hidden. The password must satisfy the configured Identity policy.

This command is restricted to the Development environment, does not start the API server and refuses to create another Administrator when an administrator account already exists.

**For an existing database that already has an Administrator, skip this step.** Do not recreate or reset accounts unnecessarily. Never place an administrator password in scripts, documentation or Git.

### 4. Start the backend

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project src/backend/FieldOps.Api/FieldOps.Api.csproj --no-launch-profile -- --urls http://localhost:5080
```

### 5. Start Angular

In a second terminal:

```powershell
Set-Location src/frontend/fieldops-web
npm.cmd ci
npm.cmd start
```

On Windows PowerShell, use `npm.cmd` to avoid restrictions affecting `npm.ps1`. On macOS/Linux, use `npm`.

Angular runs at `http://localhost:4200` and forwards `/api/**` and `/hubs/**` requests to the backend at port `5080` through the development proxy, including WebSocket upgrades.

### Pages

- `http://localhost:4200/` — Home
- `http://localhost:4200/facilities` — Facilities
- `http://localhost:4200/assets` — Assets
- `http://localhost:4200/dashboard` — Operational Dashboard (Administrator/Supervisor)
- `http://localhost:4200/incidents` — Incidents
- `http://localhost:4200/technicians` — Technicians
- `http://localhost:4200/work-orders` — Work Orders
- `http://localhost:4200/my-work-orders` — My Work Orders (Technician)
- `http://localhost:4200/users` — User Management (Administrator)
- `http://localhost:4200/login` — Login
- `http://localhost:4200/access-denied` — Access Denied

## Tests

From the repository root:

```powershell
dotnet test src/backend/FieldOps.slnx
```

From `src/frontend/fieldops-web`:

```powershell
npm.cmd test -- --watch=false
npm.cmd run build
```

Following the Phase 12 local audit (25 November 2026), **263 .NET/xUnit tests and 451 Angular/Vitest tests passed (714 total)**. The .NET Release build completed with zero warnings and zero errors, and the Angular production build succeeded.

All 40 Angular test files passed in the full regression run. The production build reports two non-blocking warnings: the application stylesheet exceeds its warning budget by 194 bytes, and Leaflet 1.9.4 produces a CommonJS optimization warning. Both are retained for review during Phase 13.

Work Order REST operations passed 38 functional HTTP checks. An additional local concurrent-request check returned one HTTP 201 Created and one HTTP 409 Conflict for two requests using the same work order code; a further duplicate returned HTTP 409, and exactly one matching record was persisted. This validates the observed HTTP behavior but does not specifically prove that SQL Server's unique-index exception handler was exercised.

Authentication and role-based authorization are implemented. Dedicated automated Identity/API integration tests, full client-side version preconditions and production deployment hardening remain future work. The project remains a local-development portfolio demonstration.

## Roadmap

- Automated integration/end-to-end tests, including database and API paths.
- Dedicated automated Identity/API integration tests and production deployment hardening.
- Docker deployment and automated delivery (CD); GitHub Actions CI is already configured as groundwork for Phase 14.
- Client-side version preconditions (such as HTTP `If-Match`) and pagination for larger-scale multi-user operation.

## Security and deployment scope

This repository is a **local-development and portfolio demonstration**, not a production-ready deployment. Authentication and role-based authorization are implemented using ASP.NET Core Identity, protected API endpoints, cookie sessions and CSRF validation. These controls do not by themselves establish production readiness. Keep secrets outside source control. Before public deployment, complete infrastructure and HTTPS hardening, secure database transport, automated Identity/API integration testing, monitoring, operational safeguards and other production security reviews.
