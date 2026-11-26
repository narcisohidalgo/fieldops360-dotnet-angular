# FieldOps 360 - Demonstration Guide

## 1. Introduction

FieldOps 360 is a full-stack operations and maintenance
management portfolio application.

It centralizes facilities, industrial assets, incidents,
technicians and work orders in a single system.

The project demonstrates the implementation of a realistic
business application using:

- ASP.NET Core 10 and C#.
- Angular 22 and TypeScript.
- SQL Server and Entity Framework Core.
- Clean Architecture.
- REST APIs.
- ASP.NET Core Identity and role-based authorization.
- SignalR real-time notifications.
- Leaflet and OpenStreetMap.
- Docker Compose and Nginx.
- GitHub Actions and GitHub Container Registry.

The application is a portfolio project with fictional
demonstration data, not an operating commercial system.

## 2. Start the application

Clone the repository:

```powershell
git clone https://github.com/narcisohidalgo/fieldops360-dotnet-angular.git
cd fieldops360-dotnet-angular
```

Start the local Docker environment using the provided
initialization and deployment script.

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/docker/Start-LocalEnvironment.ps1"
```

Follow the instructions in the
[Docker deployment guide](phase14-docker-cicd.md),
including local TLS certificate trust and Administrator
account initialization.

Once the environment is available, open:

https://localhost:8443

The Docker environment includes the Angular production
build, Nginx, ASP.NET Core API and SQL Server.

There is no need to run Angular or the .NET development
server separately when using Docker.

The application is hosted locally. A publicly accessible
production deployment is outside the current scope.

## 3. Initialize the demonstration dataset

The optional demonstration scripts create fictional
operational records through the authenticated REST API.

Run the scripts sequentially from the repository root.

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoReferenceData.ps1"

powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoIncidents.ps1"

powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoWorkOrders.ps1"

powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoUsers.ps1"
```

Administrator credentials are requested interactively.
The user initialization script also requests passwords
for the optional Supervisor and Technician accounts.

See the [demonstration data documentation](../scripts/demo/README.md)
for prerequisites, verification-only execution,
re-execution behavior and limitations.

### Dataset overview

| Entity | Demo records |
| --- | ---: |
| Facilities | 8 |
| Assets | 24 |
| Technicians | 8 |
| Incidents | 20 |
| Work orders | 24 |
| Total | 84 |

The work order dataset includes:

- 20 orders linked to incidents.
- 4 independent preventive maintenance orders.
- 4 active unassigned orders.
- At least 6 overdue active orders at initialization.

The portfolio screenshots were captured in the existing
local Docker environment, which also contained one
facility and one incident from previous validation.

Therefore, the screenshots show 9 facilities and
21 incidents rather than the 8 and 20 records created
by the optional demonstration scripts alone.

Scheduling dates are relative to the initialization date.
Overdue indicators can change as time passes.

## 4. Demonstration accounts

| Account | Role |
| --- | --- |
| Existing Administrator account | Administrator |
| supervisor@fieldops.example | Supervisor |
| technician01@fieldops.example | Technician |

The Technician account is associated with DEMO-TEC-001,
Alejandro Demo.

Passwords are chosen locally during account creation.
No default or shared passwords are published.

The Supervisor and Technician accounts are optional
for general application use but are required for the
complete role-based demonstration walkthrough.

## 5. Recommended demonstration walkthrough

The following walkthrough is designed for an approximately
eight-minute technical portfolio demonstration.

The application interface is in Spanish, while the
repository documentation is written in English.

### 5.1 Authentication

Estimated duration: 30 seconds, including introduction.

Open the login page and authenticate using the local
Administrator account.

Explain that authentication is handled by ASP.NET Core
Identity with cookie-based sessions, role authorization
and antiforgery protection.

[Screenshot: Login](screenshots/portfolio/14-login.png)

### 5.2 Operational dashboard

Estimated duration: 45 seconds.

Navigate to Dashboard.

Highlight:

- Facility and asset indicators.
- Technician counts based on active status.
- Incident and work order totals.
- Open and in-progress incidents.
- Overdue and unassigned work orders.
- Incident and work order status distributions.

The dashboard provides a consolidated operational view
of the current data returned by the backend.

[Screenshot: Dashboard](screenshots/portfolio/01-dashboard.png)

### 5.3 Facilities, geographic visualization and assets

Estimated duration: 1 minute.

Navigate to Instalaciones.

Show the registered facilities, their status and their
geographic locations.

Select the Madrid facility marker to display its
interactive information popup.

Explain that the map uses Leaflet, OpenStreetMap and
persisted facility coordinates.

Navigate to Activos to demonstrate the relationship
between facilities and their industrial assets.

Screenshots:

- [Facility management](screenshots/portfolio/02-facilities.png)
- [Interactive facility map](screenshots/portfolio/03-facilities-map.png)
- [Asset management](screenshots/portfolio/04-assets.png)

### 5.4 Incident and work order management

Estimated duration: 1 minute and 30 seconds.

Navigate to Incidencias.

Explain how incidents can be filtered by facility,
priority and status.

The incident lifecycle includes:

- Open.
- In progress.
- Resolved.
- Closed.

Supported transitions are validated by the backend.
Resolved and closed incidents can be reopened through
the corresponding business operation.

Navigate to **Órdenes de trabajo** and filter by:

DEMO-FAC-001 - Centro logístico Madrid.

Show the following three orders:

| Work order | Priority | Status |
| --- | --- | --- |
| DEMO-WO-001 | Critical | Planned |
| DEMO-WO-002 | High | In progress |
| DEMO-WO-003 | Medium | Completed |

Explain the relationships between facilities, assets,
incidents and assigned technicians.

Open the edit form for DEMO-WO-001.

Highlight the editable fields, scheduling dates and
the restrictions on changing identifiers and relationships.

Dates are displayed in local time and persisted in UTC.

Cancel the edit form without saving changes.

Navigate to **Técnicos** to show the registered technicians
and their different maintenance specialties.

Screenshots:

- [Incident management](screenshots/portfolio/05-incidents.png)
- [Technician management](screenshots/portfolio/06-technicians.png)
- [Work order management](screenshots/portfolio/07-work-orders.png)
- [Work order edit form](screenshots/portfolio/08-work-order-detail.png)

### 5.5 User management and authorization

Estimated duration: 1 minute and 30 seconds.

As Administrator, open Usuarios.

Show the three roles, active accounts and the association
between the Technician account and its technician record.

Next, authenticate as Supervisor in a separate browser
session.

Navigate to Instalaciones.

Demonstrate that the Supervisor can view facilities
and the geographic map, but cannot create, edit or
deactivate facilities.

The user administration menu is not available.

Authenticate as Technician.

Navigate to **Mis órdenes**.

The demonstration Technician has three assigned orders:

- DEMO-WO-001.
- DEMO-WO-004.
- DEMO-WO-014.

The Technician cannot access the general work order
management module or other technicians' orders.

Attempt to navigate directly to:

https://localhost:8443/users

The Angular route guard displays the access denied page.

Explain that frontend route guards are a usability
mechanism, not the server-side security boundary.

The API independently validates role permissions and
restricts technician work order access using the
authenticated identity.

The demonstration account initialization verified:

- Supervisor operational API access.
- HTTP 403 for restricted administration endpoints.
- HTTP 403 for restricted technician endpoints.
- HTTP 404 when a technician requests a foreign order.

Screenshots:

- [User management](screenshots/portfolio/09-users.png)
- [Supervisor read-only facilities](screenshots/portfolio/10-supervisor.png)
- [Technician assigned work orders](screenshots/portfolio/11-my-work-orders.png)
- [Access denied](screenshots/portfolio/12-access-denied.png)

### 5.6 Real-time notifications with SignalR

Estimated duration: 1 minute.

Open two independent browser sessions.

| Session | Role | Page |
| --- | --- | --- |
| Browser A | Administrator | Incidents |
| Browser B | Supervisor | Dashboard |

A private browser window can be used for the second
session to isolate authentication cookies.

In Browser A, edit the following incident:

DEMO-INC-020 - Revisión de iluminación de planta.

Temporarily append a short demonstration sentence
to its description and save the change.

In Browser B, open the notification panel without
manually refreshing the page.

The Supervisor receives an incident update notification.

Explain the underlying flow:

1. An authorized REST request updates the incident.
2. The application validates the business operation.
3. The change is persisted in SQL Server.
4. SignalR publishes a generic IncidentsChanged event.
5. Authorized clients receive the notification.
6. Relevant frontend data is refreshed through the API.

The event does not transmit private business entity
payloads.

After the demonstration, restore the original incident
description exactly:

> Se solicita inspeccionar la iluminación de una zona común de producción.

Save the restored description without changing the incident
priority, status or related facility.

The incident status and original business content
should remain unchanged, although its modification
timestamp and concurrency token will change.

[Screenshot: Real-time notifications](screenshots/portfolio/13-realtime.png)

### 5.7 Architecture, quality and continuous delivery

Estimated duration: 1 minute and 30 seconds.

Open the [system architecture](architecture.md)
documentation and explain the separation between:

- FieldOps.Domain.
- FieldOps.Application.
- FieldOps.Infrastructure.
- FieldOps.Api.
- Angular frontend.

Highlight dependency inversion, persistence abstractions,
business rules, dependency injection and REST contracts.

Explain the role of Entity Framework Core migrations,
SQL Server constraints and optimistic concurrency.

Show the testing strategy:

- xUnit backend unit tests.
- API and SQL Server integration tests.
- Vitest Angular unit tests.
- Playwright browser and end-to-end tests.
- Docker production-build browser tests.

The Phase 15 audit has validated 870 application tests locally,
including 559 Angular tests across 43 files.

Three Docker browser scenarios remain pending final CI,
bringing the expected complete test total to 873.

The Angular line coverage is 92.27%.
The original Phase 14 baseline recorded 794 passing scenarios.

Show the GitHub Actions workflow and explain the
separate backend, frontend, integration, Docker
validation and container publication jobs.

The pipeline publishes three application images:

- API.
- Web.
- Migrations.

Container publication is continuous delivery to GHCR.
It does not automatically deploy the application to
a publicly hosted production server.

## 6. Technical discussion topics

| Topic | Implementation |
| --- | --- |
| Architecture | Clean Architecture and dependency inversion |
| Domain modeling | Incident and work order lifecycle rules |
| Persistence | EF Core, SQL Server and migrations |
| Concurrency | SQL Server rowversion tokens |
| Frontend | Angular standalone components and reactive forms |
| Authentication | ASP.NET Core Identity and cookies |
| Authorization | Role policies and technician data isolation |
| Request protection | Antiforgery validation |
| Real-time communication | SignalR change notifications |
| Geographic visualization | Leaflet and OpenStreetMap |
| Testing | xUnit, Vitest and Playwright |
| Containerization | Docker Compose and Nginx |
| Delivery | GitHub Actions and GHCR |

These topics can be explored directly in the source
code and supporting technical documentation.

## 7. Demonstration preparation checklist

Before a live presentation:

- Start Docker Desktop and the FieldOps environment.
- Verify that the API and frontend are available.
- Confirm that the demonstration dataset is present.
- Confirm that the three user accounts can authenticate.
- Prepare independent Administrator and Supervisor sessions.
- Verify the original DEMO-INC-020 description.
- Close unrelated applications and browser notifications.
- Avoid exposing passwords or development credentials.
- Keep the architecture documentation and GitHub Actions
  workflow available.

OpenStreetMap tiles require network connectivity.

The screenshot gallery provides a fallback if a live
map or application demonstration is unavailable.

## 8. Scope and limitations

FieldOps 360 demonstrates a complete local portfolio
application and a validated container delivery workflow.

It is not a claim of commercial operation, public cloud
deployment or production readiness.

The demonstration scripts have been exercised in the
existing local Docker environment. A complete fresh
installation of the demonstration dataset in a separate
environment has not been independently repeated.

There is no automatic demonstration data reset.

Manual business changes can affect subsequent
verification-only execution.

No production credentials or real personal information
are included in the demonstration dataset.

See the deployment documentation for additional
operational and security limitations.

## 9. Related documentation

- [Main README](../README.md)
- [System architecture](architecture.md)
- [Database schema](database/README.md)
- [Demonstration data scripts](../scripts/demo/README.md)
- [Real-time operations](phase12-realtime.md)
- [Testing and quality](phase13-testing-quality.md)
- [Docker deployment and CI/CD](phase14-docker-cicd.md)
