# Phase 11 — Operational Dashboard, KPIs and GIS

> **Later implementation:** Phase 12 added automatic dashboard
> refresh through SignalR. Phase 13 added automated integration
> and browser testing, and Phase 14 added local HTTPS deployment.
> The original Phase 11 validation results remain historical.

## Status

Implemented and technically validated locally on 2026-11-25.
Git publication is handled separately after final review.

The project remains a local-development portfolio demonstration,
not a production-ready deployment.

## Scope

Phase 11 adds:

- Operational dashboard with six KPI cards.
- Statistical charts for incidents and work orders.
- Backend read-only aggregation of operational data.
- Role-based access to dashboard data.
- Optional geographic coordinates on facilities.
- Coordinate validation in Domain and Angular.
- Leaflet map using OpenStreetMap tiles.
- Popups and visual distinction between active/inactive facilities.

## Dashboard architecture

Endpoint: `GET /api/dashboard/summary`

Authorization: authenticated Administrator or Supervisor.

Backend components:

- `DashboardController` — protected REST endpoint.
- `IDashboardService` and `DashboardService` — application use case.
- `IDashboardReadRepository` — read persistence contract.
- `DashboardReadRepository` — EF Core aggregation.
- `TimeProvider` — UTC generation timestamp and overdue cutoff.

The dashboard performs read-only queries with EF Core.
Its aggregation reads the existing operational tables.
No separate reporting database or reporting schema is required.

### KPI definitions

- Facilities: total and active records.
- Assets: total and active records.
- Technicians: total and active records.
- Incidents: total, Open, InProgress, Resolved and Closed.
- Work orders: total, Planned, InProgress, Completed and Cancelled.
- Overdue: Planned or InProgress orders with a due date before
  the UTC evaluation time.
- Unassigned planned: Planned orders without an assigned technician.

`generatedAtUtc` records the UTC calculation time.
The Angular interface displays it in the browser's local time.

The response is marked as non-cacheable.

## Angular dashboard

Route: `/dashboard`

Access: Administrator and Supervisor, protected by the Angular
route guard and, independently, the backend authorization policy.

The dashboard includes:

- Six KPI cards with links to operational modules.
- A manual refresh action.
- Loading, connectivity and authorization error handling.
- Responsive horizontal bar charts.
- Four incident statuses and four work-order statuses.
- Counts and percentages derived from API results.

Charts are implemented without an additional charting library.

## Facility geolocation

Domain entity: `Facility`

Optional coordinates:

| Field | SQL Server | Domain range |
| --- | --- | --- |
| Latitude | decimal(9,6) NULL | -90 to 90 |
| Longitude | decimal(9,6) NULL | -180 to 180 |

Both coordinates must be present together or both must be NULL.
The domain validates coordinate ranges before assignment.

Migration:
`20261125065110_AddFacilityCoordinates`

The migration adds only the two nullable columns to `Facilities`.
Existing records remain valid without coordinates.

The Angular create/edit forms:

- Accept coordinates as optional values.
- Validate coordinate pairs and geographic ranges.
- Accept a maximum of six decimal places.
- Send numeric values or NULL to the API.
- Preserve previously entered coordinates when editing.
- Allow clearing both coordinates.

The database uses six-decimal precision; the Angular form enforces
the six-decimal input rule. The domain independently validates
geographic ranges and completeness.

## Leaflet map

Location: Facilities page (`/facilities`).

Library: Leaflet 1.9.4 with TypeScript types.

Base layer: OpenStreetMap tiles.

The map uses the facilities returned by the existing
`GET /api/facilities` endpoint; no extra GIS REST endpoint is needed.

Features:

- Display markers only when both coordinates are valid.
- Blue markers for active facilities.
- Red markers for inactive facilities.
- Safe DOM-based popups with facility details.
- Automatic fit to multiple facility locations.
- Zoom to a single located facility.
- Show a count of located and unlocated facilities.
- Allow normal Leaflet zoom and pan.

Popup text is assigned using DOM `textContent` rather than
interpreting raw API values as HTML.

The map uses a lazy-loaded Leaflet module.
Angular may show a CommonJS optimization warning for Leaflet 1.9.4.
The production build completes successfully despite that warning.

## Manual functional verification

Verified on 2026-11-25:

- Anonymous dashboard request returned HTTP 401.
- Administrator dashboard request returned HTTP 200.
- Dashboard KPI values matched the local SQL Server data.
- Dashboard navigation and manual refresh worked.
- Incident and work-order charts rendered correctly.
- Facility coordinates were saved through the edit form.
- OpenStreetMap loaded in the Facilities page.
- The located-facility counter updated from 0/3 to 1/3.
- A blue marker displayed its facility information popup.
- The remaining unlocated facilities remained unchanged.

The demonstration coordinates for `FAC-001` point approximately
to central Cordoba, Spain. They are not verified as the
installation's exact physical address.

## Database migration verification

The migration was applied to local `FieldOpsDb`.

Record counts were unchanged before and after migration:

| Table | Records |
| --- | ---: |
| Facilities | 3 |
| Assets | 2 |
| Incidents | 2 |
| Technicians | 4 |
| WorkOrders | 5 |
| AspNetUsers | 7 |

Both new facility columns were verified as nullable
`decimal(9,6)`.

## Final technical audit

Validation date: 2026-11-25.

- .NET 10 Release solution build: passed.
- Backend xUnit tests: 263 passed, 0 failed.
- Angular tests: 398 verified across the full run and the
  targeted rerun of the corrected navigation test.
- Angular production build: passed.
- Manual GIS and dashboard interactions: passed.

The Angular full run initially had one outdated navigation test:
the Administrator menu expectation omitted `/dashboard`.
After updating that expectation, all eight tests in `app.spec.ts`
passed. The other 390 tests passed in the full run.

## Limitations and future work

- Geographic coordinates are entered manually; there is no
  geocoding or automatic address validation.
- Demonstration coordinates must not be treated as verified
  physical addresses.
- OpenStreetMap tiles require network access. Review tile
  provider usage policies before public deployment.
- Dashboard metrics originally refreshed on request; automatic refresh was added in Phase 12.
- Automated API, Identity, database and browser integration
  tests were subsequently implemented in Phase 13.
- Production HTTPS, security, deployment and monitoring
  hardening remain future work.