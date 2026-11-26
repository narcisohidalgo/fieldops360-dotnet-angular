# FieldOps 360 - Angular Frontend

Angular 22 frontend for FieldOps 360, an operations and maintenance
management portfolio application backed by ASP.NET Core 10,
Entity Framework Core and SQL Server.

See the [main project README](../../../README.md) for architecture,
backend configuration, database migrations and deployment instructions.

## Technology stack

- Angular 22 and TypeScript.
- Standalone components and lazy-loaded routes.
- Angular signals and computed state.
- Reactive forms and template-driven login.
- HttpClient and RxJS.
- ASP.NET Core Identity cookie authentication and CSRF protection.
- SignalR real-time notifications.
- Leaflet and OpenStreetMap.
- SCSS.
- Vitest, Angular TestBed and Playwright.

## Application routes

| Route | Module |
| --- | --- |
| `/` | Home |
| `/login` | Authentication |
| `/access-denied` | Access denied |
| `/dashboard` | Operational KPIs and statistics |
| `/facilities` | Facility management and geographic visualization |
| `/assets` | Industrial asset management |
| `/incidents` | Incident management and lifecycle |
| `/technicians` | Technician management |
| `/work-orders` | Work order planning and assignment |
| `/my-work-orders` | Assigned technician work orders |
| `/users` | Identity user and role administration |

The application interface is in Spanish. Navigation and available
actions depend on the authenticated user's role.

## Authentication and security

- Cookie-based authentication with ASP.NET Core Identity.
- Session restoration through `GET /api/auth/me`.
- CSRF tokens for state-changing API requests.
- Route guards and role-aware navigation.
- Centralized handling of expired operational sessions.
- Validated return URLs after authentication.
- Protection against duplicate form submissions.
- No authentication credentials stored in browser storage.

The backend remains the authorization boundary.
Frontend guards and hidden controls do not replace server-side
authorization or resource ownership checks.

## Real-time operations and GIS

SignalR provides generic operational change notifications.
Incident lists, work order lists and dashboard indicators
refresh through authorized REST requests.

Leaflet displays facilities with valid stored coordinates
using OpenStreetMap tiles.

External map tiles require network connectivity.

## Local development

Requirements:

- Node.js 24 and npm.
- .NET 10 SDK.
- SQL Server with the EF Core migrations applied.

Configure and start the backend as described in the main README.

From this frontend directory:

    npm.cmd ci
    npm.cmd start

Open http://localhost:4200.

The development proxy forwards API and SignalR requests
to http://127.0.0.1:5080, including WebSocket upgrades.

Alternatively, the production frontend can be served by
Nginx through the local Docker environment at
https://localhost:8443.

## Testing and production build

Run Angular unit and component tests:

    npm.cmd test -- --watch=false

Collect coverage:

    npm.cmd run test:coverage

Build the production application:

    npm.cmd run build

Install Chromium for Playwright:

    npx.cmd playwright install chromium

Run the isolated browser smoke test:

    npm.cmd run e2e

The real browser suite is executed through the .NET integration
test coordinator using isolated SQL Server data.

The Docker browser suite targets the running HTTPS environment:

    npm.cmd run e2e:docker

The additional real authentication scenario is enabled in CI
using an isolated administrator account.

See the [testing documentation](../../../docs/phase13-testing-quality.md)
and [Docker and CI/CD guide](../../../docs/phase14-docker-cicd.md)
for prerequisites and execution details.

## Phase 15 local audit results

| Metric | Result |
| --- | ---: |
| Vitest tests passed | 559 |
| Test files | 43 |
| Statement coverage | 92.57% |
| Branch coverage | 88.51% |
| Function coverage | 87.78% |
| Line coverage | 92.27% |
| Initial production bundle (raw) | 383.35 kB |

All 559 Angular tests passed without failures or skipped tests.
The production build completed without warnings.

The isolated browser smoke test and all four native real
browser scenarios also passed.

The updated three-scenario Docker browser suite and all five
CI/CD jobs passed in GitHub Actions run #7 on 26 November 2026.

## Project structure

- `src/app/core/`: authentication, guards, interceptors and shared services.
- `src/app/features/`: feature-specific pages, components, models and services.
- `src/app/operational-notifications/`: notification panel.
- `e2e/`: Playwright browser scenarios.
- `nginx.conf`: production reverse proxy and SPA configuration.

## Limitations

- Browser-side version preconditions for stale edits are not implemented.
- Notification history is stored in browser memory only.
- Automated browser verification currently targets Chromium.
- Public production hosting and additional security hardening
  remain outside the current scope.

See the [main README](../../../README.md) for the complete
application documentation.
