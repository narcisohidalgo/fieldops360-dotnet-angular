# FieldOps 360

**Enterprise Operations & Maintenance Management Platform**

FieldOps 360 is a full-stack portfolio project for managing facilities, their equipment and operational incidents. The backend uses ASP.NET Core 10 and Entity Framework Core with SQL Server; the frontend uses Angular 22.

> **Project status:** Facilities, Assets and Incidents are implemented for local development and demonstration. Authentication, authorization, deployment hardening and other modules remain future work.

## Technology stack

| Layer | Technology |
| --- | --- |
| Backend | ASP.NET Core 10 Web API, C# |
| Frontend | Angular 22, TypeScript, standalone components, reactive forms, signals |
| Persistence | SQL Server, Entity Framework Core 10, migrations |
| Architecture | Clean Architecture (Domain, Application, Infrastructure, API) |
| Tests | xUnit (.NET), Vitest (Angular) |

## Implemented features

### Facilities

- List facilities and retrieve an individual facility.
- Create and update facilities with validation and unique facility codes.
- Activate or deactivate facilities without deleting their records.

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

### Optimistic concurrency

SQL Server `rowversion` is configured as an EF Core concurrency token for incidents. Concurrent updates based on the same previously loaded database version are detected, and the API returns HTTP 409 Conflict.

The browser does not yet transmit an explicit version precondition. Full protection against stale edits from separately opened browser sessions is planned for a later phase.

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
  database/                    # SQL database documentation
```

The frontend uses feature-based folders under `src/app/features/`, Angular `HttpClient` services and lazy-loaded routes.

## Main REST endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/facilities` | List facilities |
| GET | `/api/assets` | List assets; optional `facilityId` filter |
| GET | `/api/incidents` | List incidents; optional `facilityId`, `assetId`, `status`, `priority` filters |
| GET | `/api/incidents/{id}` | Retrieve an incident |
| POST | `/api/incidents` | Create an incident |
| PUT | `/api/incidents/{id}` | Edit permitted incident details |
| PATCH | `/api/incidents/{id}/start` | Open → InProgress |
| PATCH | `/api/incidents/{id}/resolve` | InProgress → Resolved |
| PATCH | `/api/incidents/{id}/close` | Resolved → Closed |
| PATCH | `/api/incidents/{id}/reopen` | Resolved/Closed → Open |

The Facilities and Assets controllers also provide their own create, update and activation/deactivation operations.

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

This applies all available migrations, including `InitialCreate`, `AddIncidents` and `AddIncidentRowVersion`, as needed. The file `docs/database/InitialCreate.sql` represents **only the initial schema**, not the complete current schema; see [Database documentation](docs/database/README.md).

### 3. Start the backend

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project src/backend/FieldOps.Api/FieldOps.Api.csproj --no-launch-profile -- --urls http://localhost:5080
```

### 4. Start Angular

In a second terminal:

```powershell
Set-Location src/frontend/fieldops-web
npm ci
npm start
```

Angular runs at `http://localhost:4200` and forwards `/api/**` requests to the backend at port `5080` via the development proxy.

### Pages

- `http://localhost:4200/` — Home
- `http://localhost:4200/facilities` — Facilities
- `http://localhost:4200/assets` — Assets
- `http://localhost:4200/incidents` — Incidents

## Tests

From the repository root:

```powershell
dotnet test src/backend/FieldOps.slnx
```

From `src/frontend/fieldops-web`:

```powershell
npm test -- --watch=false
npm run build
```

At the end of Phase 7 local testing (23 November 2026), the project passed **115 xUnit tests** and **175 Angular/Vitest tests**, as well as manual REST API and end-to-end browser checks against a local SQL Server database.

## Roadmap

- Technician management.
- Work orders.
- Automated integration/end-to-end tests, including database and API paths.
- Authentication and authorization, plus deployment hardening.
- Docker deployment and GitHub Actions CI/CD.
- Client-side version preconditions (such as HTTP `If-Match`) and pagination for larger-scale multi-user operation.

## Security and deployment scope

This repository is a **local-development and portfolio demonstration**, not a production-ready deployment. Authentication and authorization are not yet implemented; the API must not be exposed publicly without appropriate security controls. Keep secrets outside source control. Complete authentication, authorization, secure database transport, client-side version preconditions, monitoring and deployment hardening before production use.
