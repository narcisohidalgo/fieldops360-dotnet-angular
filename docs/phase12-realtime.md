# Phase 12 — Real-Time Operations with SignalR

> **Phase 15 audit update:** Manager-group broadcasting has been
> replaced by connection tracking and publication-time Identity
> validation. The original Phase 12 test results remain historical.

## Status

Implemented locally on 2026-11-25.

Targeted unit tests, two-browser functional verification,
full regression suites and production builds passed
on 2026-11-25.

FieldOps 360 remains a local-development portfolio project,
not a production-ready deployment.

## Scope

Phase 12 adds:

- ASP.NET Core SignalR operational hub.
- Server-published events after successful REST mutations.
- Live refresh of work-order and incident lists.
- Live operational dashboard KPI and chart refresh.
- In-memory notifications for Administrator and Supervisor.
- Connection recovery with bounded retry delays.
- Automatic cleanup on logout and component destruction.

No database schema changes or EF Core migrations were needed.

## Architecture

The existing REST API remains the source of operational data.

Flow:

1. An authenticated user changes an incident or work order.
2. The application service persists and validates the change.
3. The controller asks the event publisher to notify clients.
4. The publisher revalidates manager permissions and sends a generic event to eligible connection IDs.
5. Angular receives the event.
6. The relevant component reloads authorized data through REST.
7. Angular updates the visible list, KPIs or charts.

Event messages contain no entity details or private data.

## Backend components

- `FieldOps.Api/Hubs/OperationsHub.cs`
- `FieldOps.Api/Hubs/OperationsConnectionRegistry.cs`
- `FieldOps.Api/Hubs/OperationsEventPublisher.cs`
- `FieldOps.Api/Program.cs`
- `IncidentsController`
- `WorkOrdersController`
- `MyWorkOrdersController`

SignalR route:

`/hubs/operations`

Event names:

- `WorkOrdersChanged`
- `IncidentsChanged`

The event publisher uses `IHubContext<OperationsHub>`.

Publishing failures are logged without turning an already
persisted REST mutation into an incorrect HTTP failure response.

Events are emitted after successful persistence, not before.

## Security and authorization

The hub requires authentication under the
`Operations.ReadBasic` authorization policy.

This policy permits Administrator, Supervisor and Technician
to establish an authenticated connection.

Only Administrator and Supervisor connections are registered
for operational notifications.

Before publication, the publisher checks account activation,
current manager roles and security stamps in the Identity database.

Events are delivered to eligible connection IDs only.
A failed authorization lookup does not fall back to broadcasting.

Technician accounts are excluded from operational notifications.
Their work-order access remains restricted by the existing
server-side REST authorization and ownership checks.

Angular hides the notification panel from technicians and
anonymous users, but UI visibility is not a security boundary.

SignalR event messages carry no incident IDs, work-order IDs,
user details or other entity payloads.

The backend REST policies remain responsible for protecting
the underlying operational data.

The hub is server-to-client notification infrastructure;
it does not expose application mutation methods.

The hub is configured to close connections when their
authentication expires.

## Angular components

Realtime infrastructure:

`src/app/core/services/realtime.service.ts`

Notification state:

`src/app/core/services/operational-notifications.service.ts`

The application shell connects and disconnects SignalR
according to the authenticated session.

Work Orders and Incidents pages subscribe to their respective
events and refresh their REST lists while preserving filters.

The dashboard subscribes to both operational event types
and reloads `GET /api/dashboard/summary`.

A load-sequence guard prevents obsolete HTTP responses or
errors from replacing newer data.

Angular subscriptions are released when components are
destroyed.

## Operational notifications

The notification bell is visible to Administrator and
Supervisor accounts.

Features:

- Unread notification count.
- Most recent notifications shown first.
- Maximum of 20 notifications in memory.
- Mark one notification as read.
- Mark all notifications as read.
- Clear notification history.
- Links to the relevant operational module.
- Clear notifications after logout or identity change.

Notifications are generic change announcements.
They do not include the affected record or its private fields.

Notification history is held in browser memory only.
It is not persisted to SQL Server, does not synchronize
read state between devices and is lost on a page reload.

Reconnection refresh events do not create false notifications.

## Connection lifecycle and recovery

The SignalR client uses automatic reconnect delays of
0, 2, 10 and 30 seconds after an established connection fails.

Additional client-side recovery handles:

- Failure of the initial connection attempt.
- Exhaustion of automatic reconnect attempts.

Recovery waits progressively for 5, 10, 20 and up to
30 seconds between attempts.

Pending retries are cancelled during logout.
Connection start and stop operations are serialized.

After recovery, Angular refreshes operational data
through REST to reconcile potentially missed changes.

This is state synchronization, not replay of every
notification lost during a disconnection.

## Development configuration

Angular runs at `http://localhost:4200`.

ASP.NET Core runs at `http://localhost:5080`.

The Angular development proxy forwards:

- `/api/**` — REST API.
- `/hubs/**` — SignalR, including WebSocket upgrades.

Cookie-based authentication is reused through
the same-origin development proxy.

For public deployment, configure secure HTTPS/WSS,
trusted proxies, monitoring and production security controls.

## Verification

Targeted Angular tests passed on 2026-11-25:

- RealtimeService: 21 tests.
- OperationalNotificationsService: 13 tests.
- App: 18 tests.
- DashboardPage: 11 tests.
- IncidentsPage: 35 tests.
- WorkOrdersPage: 29 tests.

The targeted test executions were separate and do not
replace a full regression run.

Manual two-browser verification passed:

- Work-order changes refreshed another browser session.
- Incident changes refreshed another browser session.
- Manager notifications appeared without manual refresh.
- Unread counts and notification actions worked.
- Dashboard indicators and status charts refreshed.
- Session-specific notification visibility was verified.

### Final global validation

Completed on 2026-11-25:

| Validation | Result |
|---|---|
| .NET Release build | Passed, 0 warnings, 0 errors |
| .NET/xUnit tests | 263 of 263 passed |
| Angular/Vitest tests | 451 of 451 passed |
| Angular test files | 40 of 40 passed |
| Total automated tests | 714 passed |
| Angular production build | Passed with 2 non-blocking warnings |
| Git diff check | Passed |

The Angular build warnings concern the application stylesheet
budget and the Leaflet CommonJS dependency. They remain
scheduled for review during Phase 13.

## Limitations

- Notifications are not durable or persisted in a database.
- Events do not provide guaranteed delivery or historical replay.
- The connection registry is local to the running server;
  multi-instance scaling requires suitable infrastructure.
- Permission revalidation prevents new notifications to stale
  connections but does not forcibly disconnect their sockets.
- Events already in flight cannot be recalled.
- There is no transactional outbox for event delivery.
- Backend SignalR integration tests were added in Phase 13.
  Phase 15 adds regressions for account deactivation, role removal,
  password reset and reactivation with a fresh session.
- Production observability, deployment, HTTPS hardening
  and distributed infrastructure belong to Phase 14.
- GitHub Actions CI was prepared in advance as groundwork
  for Phase 14; it is not the SignalR functionality of Phase 12.
