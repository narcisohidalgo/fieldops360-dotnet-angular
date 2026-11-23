# FieldOps 360 - Angular Frontend

Angular 22 frontend for FieldOps 360, an operations and maintenance management portfolio project.

The application communicates with an ASP.NET Core 10 REST API backed by SQL Server and Entity Framework Core.

See the [main project README](../../../README.md) for architecture, backend configuration and database migrations.

## Technology stack

- Angular 22 and TypeScript
- Standalone components and lazy-loaded routes
- Angular signals and computed state
- Reactive Forms and validation
- HttpClient and RxJS
- SCSS
- Vitest unit and component tests

## Implemented modules

| Route | Module | Features |
| --- | --- | --- |
| / | Home | Application landing page |
| /facilities | Facilities | Create, edit, list and activate/deactivate facilities |
| /assets | Assets | Manage equipment associated with facilities |
| /incidents | Incidents | Create, edit, filter and change incident status |

## Incident management

Incidents belong to a facility and can optionally reference an asset from the same facility.

Supported priorities:

- Low
- Medium
- High
- Critical

Supported workflow:

    Open -> InProgress -> Resolved -> Closed

Resolved and closed incidents can be reopened.

The UI provides validated forms, filters, confirmation panels, loading states and HTTP error handling.

The API can return HTTP 409 for invalid state transitions or concurrent modifications.

## Local development

### Requirements

- Node.js and npm compatible with Angular 22
- ASP.NET Core 10 backend
- SQL Server with the EF Core migrations applied

Configure and start the backend using the instructions in the main project README.

From this frontend directory, install dependencies:

    npm ci

Start the Angular development server:

    npm start

Open http://localhost:4200

The development proxy defined in src/proxy.conf.json forwards API requests to http://127.0.0.1:5080.

## Tests

Run all Angular tests:

    npm test -- --watch=false

Build the production application:

    npm run build

At the end of Phase 7, the frontend passed 175 Vitest tests across 16 test files.

The production build was also verified successfully.

These results describe the local Phase 7 baseline, not continuous integration.

## Project structure

The frontend groups functionality by feature under src/app/features:

- home
- facilities
- assets
- incidents

Each feature contains its corresponding components, models, pages, services and tests as needed.

## Current limitations

- Authentication and authorization are not yet implemented.
- Browser-side version preconditions for stale edits remain future work.
- Automated browser end-to-end tests are planned.
- Production deployment and security hardening remain future work.

This frontend is intended for local development and portfolio demonstration.

See the [main README](../../../README.md) for the complete roadmap and security notes.
