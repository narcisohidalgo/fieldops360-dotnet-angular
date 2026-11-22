# FieldOps 360

Enterprise Operations & Maintenance Management Platform

## Overview

FieldOps 360 is a full-stack enterprise application built with ASP.NET Core and Angular.

The current implementation manages facilities and their associated assets. Additional modules are planned for future phases.

## Technology Stack

- Backend: ASP.NET Core 10 Web API
- Frontend: Angular 22 and TypeScript
- Database: SQL Server
- ORM: Entity Framework Core
- Architecture: Clean Architecture
- Testing: xUnit and Vitest

## Solution Structure

- src/backend/FieldOps.Api
- src/backend/FieldOps.Application
- src/backend/FieldOps.Domain
- src/backend/FieldOps.Infrastructure
- src/frontend/fieldops-web
- tests
- docs

## Implemented Features

### Facilities

- List and retrieve facilities.
- Create facilities with validation.
- Update facility details.
- Activate and deactivate facilities.

### Assets

- List and retrieve assets.
- Filter assets by facility through the REST API.
- Display associated facility information.
- Create assets with field validation.
- Prevent duplicate asset codes within the same facility.
- Update asset names and descriptions.
- Activate and deactivate assets without deleting their records.

## Architecture

The backend follows Clean Architecture:

- Domain: entities and business rules.
- Application: use cases, DTOs and abstractions.
- Infrastructure: EF Core repositories and SQL Server persistence.
- API: ASP.NET Core REST controllers.

The Angular frontend uses standalone components, reactive forms, signals, HTTP services and lazy-loaded feature pages.

## Local Development

Requirements:

- .NET 10 SDK
- Node.js and npm
- SQL Server

The API requires the `ConnectionStrings:FieldOpsDb` setting.

For local development, configure the connection string using .NET User Secrets.
Run this command from the repository root:

    dotnet user-secrets set "ConnectionStrings:FieldOpsDb" "Server=localhost;Database=FieldOpsDb;Trusted_Connection=True;TrustServerCertificate=True" --project src/backend/FieldOps.Api/FieldOps.Api.csproj

Adjust the server name or port to match your SQL Server instance.
The connection string above is intended for local development.

Create the database and apply the existing EF Core migration before
running the API. The database schema is also available in
`docs/database/InitialCreate.sql`.

Do not commit database credentials or other secrets to Git.

Start the backend from the repository root:

    $env:ASPNETCORE_ENVIRONMENT = "Development"
    dotnet run --project src/backend/FieldOps.Api/FieldOps.Api.csproj --no-launch-profile -- --urls http://localhost:5080

Start Angular from its project directory:

    cd src/frontend/fieldops-web
    npm install
    npm start

The Angular development server forwards API requests to ASP.NET Core through its proxy configuration.

Application pages:

- http://localhost:4200/facilities
- http://localhost:4200/assets

## Tests

Backend, from the repository root:

    dotnet test src/backend/FieldOps.slnx

Frontend, from src/frontend/fieldops-web:

    npm test -- --watch=false
    npm run build

The project includes automated backend and frontend tests.

## Roadmap

Planned future development includes:

- Incident management
- Technician management
- Work orders
- End-to-end testing with Playwright
- Docker deployment
- GitHub Actions CI/CD

## Project Status

Under active development.

This repository is currently intended for local development and portfolio
demonstration. Authentication and authorization have not yet been implemented.
Do not expose the REST API publicly without appropriate security controls.

Facilities and Assets have been implemented and verified against the local SQL Server database.
