# Phase 10 - Authentication, Users, Roles and Security

> **Phase 15 audit update:** The original Phase 10 results below
> are retained as historical evidence. Identity and API integration
> tests were subsequently implemented in Phase 13.
>
> Phase 15 adds a consistent 1024-character password maximum,
> concurrent administrative conflict handling, centralized
> frontend session expiry handling and current-permission
> validation for SignalR notifications.
>
> See the [main README](../../README.md) and
> [real-time documentation](../phase12-realtime.md) for current behavior.

## Status

Phase 10 implementation and functional verification completed on 2026-11-24. Final audit and Git publication completed on 2026-11-25 (commit 4fba51440dc03dbdec38b8e6ba4519526105b840).

Baseline commit: 5cb9dd84bc1161139aa67f3fad9ce052dc435864.

## Goals

- Authenticate users of the Angular SPA.
- Enforce server-side authorization on all operational endpoints.
- Introduce role-based and resource-based permissions.
- Preserve existing business entities and SQL Server data.
- Add automated authentication and authorization tests.
- Avoid exposing credentials or secrets in Git.

## Architecture

Backend: ASP.NET Core 10 Web API.
Frontend: Angular 22.
Database: SQL Server.
Identity: ASP.NET Core Identity with GUID user and role keys.

Use the existing SQL Server database and EF Core migration
history. Extend persistence with Identity tables without
recreating existing business tables.

Keep ASP.NET Core Identity types out of FieldOps.Domain.
Use the authenticated Identity principal and server-side technician link
for resource authorization. A reusable current-user abstraction
can be introduced as the application grows.

## Authentication

Primary browser authentication: ASP.NET Core Identity
application cookie.

Cookie requirements:
- HttpOnly.
- Secure over HTTPS.
- Appropriate SameSite policy.
- Finite session lifetime.
- Server-side logout and security-stamp handling.
- No authentication credentials in localStorage.

Provide application-owned authentication endpoints:
- GET /api/auth/csrf
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

Do not expose public registration by default.
Administrators provision accounts through protected operations.

Do not implement a custom JWT issuer for the browser SPA.
OAuth2/OIDC with an external identity provider can be
considered later if other client types require it.

## Roles

Administrator:
- Manage users and role assignments.
- Manage all facilities, assets, incidents, technicians,
  and work orders.

Supervisor:
- Read facilities.
- Manage operational assets, incidents, technicians,
  and work orders.
- Assign technicians and manage work order transitions.
- Cannot manage user accounts or role assignments.

Technician:
- Read facilities and assets.
- Cannot access incidents in the current implementation.
- Read work orders assigned to their linked technician identity.
- Start or complete only their assigned work orders.
- Cannot assign technicians, cancel orders, or administer users.

Enforce permissions on the API. Angular guards and hidden
controls provide user experience, not a security boundary.

## Identity and Technician relationship

An Identity user account is separate from a Technician record.

A Technician record does not automatically grant login access.
A Technician-role account must be linked to an active Technician record when created or activated.
Administrator and Supervisor accounts must not have a Technician link.

Validate links and enforce uniqueness as part of user management.
Never trust a technician ID supplied by a client to establish
ownership of an authenticated session.

## Security requirements

- Default-deny authorization for operational APIs.
- Explicit exceptions only for intended anonymous endpoints.
- Return HTTP 401 for unauthenticated access.
- Return HTTP 403 for authenticated but unauthorized access.
- Validate role permissions on every sensitive mutation.
- Validate technician ownership on relevant resource actions.
- Protect cookie-authenticated state changes against CSRF.
- Require HTTPS and Secure authentication cookies outside Development.
- Angular uses the development /api proxy; no permissive cross-origin CORS policy is configured.
- Enforce Identity password and account lockout policies (5 failed attempts; 15-minute lockout). General HTTP rate limiting is not implemented.
- Prevent user enumeration and sensitive data disclosure.
- Keep secrets in local configuration or secure secret stores.
- Do not seed hardcoded admin passwords.
- Never commit session cookies, tokens, passwords or SQL secrets.

## Angular

- Login page with template-driven form (FormsModule/ngForm).
- Authentication/session service.
- Route guards for protected pages.
- Functional HTTP interceptor for CSRF protection
  on unsafe requests to the same-origin API.
- Role-aware navigation and actions.
- Restore session using GET /api/auth/me.
- Do not store authentication secrets in browser storage.
- Use antiforgery tokens/headers for protected mutations.

## Migration strategy

- Add Identity schema through a new EF Core migration.
- Preserve Facilities, Assets, Incidents, Technicians
  and WorkOrders data.
- Configure and test authentication before making every
  operational endpoint require authorization.
- Bootstrap the initial administrator with credentials
  supplied securely outside source control.
- Validate that existing business functions still work.

## Verification

- Existing suites passed on 2026-11-24: .NET xUnit 246/246 and Angular Vitest 376/376 (622 total).
- Anonymous protected API request returns 401.
- Authenticated user without permission receives 403.
- Authorized operation succeeds.
- Technician cannot modify another technician's work orders.
- Invalid credentials are rejected.
- Identity account lockout is configured; dedicated automated authentication integration tests and general HTTP rate limiting remain pending.
- CSRF protections reject invalid unsafe requests.
- Logout invalidates the browser session.
- Database migration preserves previous records.

## Implemented functionality and audit status (2026-11-24)

- ASP.NET Core Identity with GUID-based users and roles.
- Administrator, Supervisor and Technician authorization policies.
- HttpOnly authentication cookie and server-side logout.
- Global antiforgery validation for unsafe MVC API requests.
- Login, logout, current-session and CSRF endpoints.
- Initial Administrator bootstrap restricted to Development and an interactive terminal.
- Account management restricted to Administrator.
- User creation, editing, activation, deactivation and administrative password resets.
- Security stamp validation on every authenticated request.
- Prevention of deactivating or demoting the last active Administrator.
- Serializable transactions for sensitive user management operations.
- Unique optional TechnicianId database relationship; required for Technician accounts.
- Technician work-order access scoped to the linked authenticated technician.
- SQL Server RowVersion concurrency protection for WorkOrders.
- Lockout: 5 failed login attempts and a 15-minute lockout period.
- Password policy: 12-character minimum, uppercase, lowercase, digit, non-alphanumeric character and 3 unique characters.

### Verification performed

- .NET application tests: 246 passed, 0 failed.
- Angular tests: 376 passed, 0 failed.
- Angular production build passed.
- Angular NG0956 warnings resolved.
- Manual HTTP security and role authorization scenarios passed.
- Angular Administrator, Supervisor and Technician flows manually verified.
- Last-active-Administrator protection tested using a separate QA database.
- QA accounts deactivated and temporary technician link released.
- Identity migration and SQL Server WorkOrders RowVersion reviewed.

### Phase 10 historical follow-up

- Final Phase 10 code, migration and documentation audit completed before publication.
- Add dedicated automated ASP.NET Core Identity/API integration tests in a future testing phase.
- Review deployment hardening before a public production deployment.
- Phase 10 changes committed and published to GitHub after validation.

---
## Completion criteria

Identity and authentication work end to end.
All operational endpoints are protected.
Roles and resource ownership are enforced.
Angular login and logout work.
Security tests pass.
Documentation and code audit are complete.
Commit and push are performed only after validation.
