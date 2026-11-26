# FieldOps 360 - Demonstration Data

## Purpose

These scripts populate the local FieldOps 360 Docker
environment with fictional operational data for portfolio
demonstrations, technical interviews and feature exploration.

They are optional and are not executed automatically
during application startup or container deployment.

All business records and demo accounts are created through
the authenticated REST API, preserving application
validation, domain rules and authorization boundaries.

## Prerequisites

- A working FieldOps 360 Docker Compose environment.
- Windows PowerShell 5.1.
- The local HTTPS endpoint at https://localhost:8443.
- A trusted local development TLS certificate.
- An active Administrator account.
- Completed Entity Framework Core migrations.

See [Docker deployment documentation](../../docs/phase14-docker-cicd.md)
for environment initialization instructions.

## Demonstration dataset

| Entity | Demo records |
| --- | ---: |
| Facilities | 8 |
| Assets | 24 |
| Technicians | 8 |
| Incidents | 20 |
| Work orders | 24 |
| Total operational records | 84 |

The dataset contains eight fictional facilities distributed
across Spain, three assets per facility, technicians with
different specialties and maintenance operations.

Facility coordinates are illustrative and do not identify
actual industrial businesses.

Existing non-demo records are retained.

## Initialization

Run the following commands sequentially from the repository
root, using Windows PowerShell.

### 1. Reference data

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoReferenceData.ps1"
```

Creates facilities, assets and technicians.

### 2. Incidents

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoIncidents.ps1"
```

Creates incidents and executes valid domain transitions.

### 3. Work orders

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoWorkOrders.ps1"
```

Creates assigned and unassigned work orders, including
corrective maintenance and independent preventive tasks.

### 4. Optional demonstration users

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoUsers.ps1"
```

Creates Supervisor and Technician demo accounts.

The scripts request credentials interactively.
No default passwords are supplied or stored in the repository.

## Incident distribution

| Status | Records |
| --- | ---: |
| Open | 7 |
| In progress | 6 |
| Resolved | 4 |
| Closed | 3 |

| Priority | Records |
| --- | ---: |
| Low | 4 |
| Medium | 7 |
| High | 6 |
| Critical | 3 |

## Work order distribution

| Status | Records |
| --- | ---: |
| Planned | 8 |
| In progress | 6 |
| Completed | 7 |
| Cancelled | 3 |

| Priority | Records |
| --- | ---: |
| Low | 6 |
| Medium | 9 |
| High | 6 |
| Critical | 3 |

Additional operational indicators:

- 20 work orders linked to incidents.
- 4 independent preventive maintenance orders.
- 4 active unassigned work orders.
- At least 6 overdue active work orders at initialization.

Scheduling dates are generated relative to the UTC
initialization date and are retained on subsequent runs.
Overdue counts can increase over time.

## Demonstration accounts

| Account | Role |
| --- | --- |
| Existing Administrator | Administrator |
| supervisor@fieldops.example | Supervisor |
| technician01@fieldops.example | Technician |

The Technician account is linked to DEMO-TEC-001
(Alejandro Demo), with the following assigned work orders:

- DEMO-WO-001
- DEMO-WO-004
- DEMO-WO-014

The user initialization script also verifies role-based
authorization and server-side work order isolation.

## Verification-only mode

All four scripts support the VerifyOnly switch.

For example:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "./scripts/demo/Initialize-DemoReferenceData.ps1" -VerifyOnly
```

This mode blocks business data write requests and does
not create missing records or overwrite existing records.
Authentication and logout requests are still required.

Use the same switch with the incident, work order and
user initialization scripts.

## Re-execution and limitations

- The scripts target the local FieldOps Docker environment.
- Demo facilities, assets, technicians and work orders
  are identified through reserved DEMO codes.
- Incidents use a DEMO-INC prefix in their title.
- Matching existing records are skipped.
- All demo facilities, assets and technicians must be active.
- Inactive reference records are treated as conflicts and
  are not automatically reactivated.
- Conflicting records cause initialization to stop.
- Compatible interrupted lifecycle initialization can
  be resumed for incidents and work orders.
- Initialization is not a single database transaction.
- Do not execute the scripts concurrently.
- No automatic data deletion or reset is performed.
- Verification expects the original demo scenario.
  Manual changes made during a demonstration may cause
  subsequent verification to fail.
- Authentication may update normal Identity security
  metadata, such as failed-login counters.
- The scripts are intended for local portfolio and
  development environments, not production data seeding.

## Security

All demo names and email addresses are fictional.

The .example domain is reserved for documentation
and illustrative use.

Passwords are entered interactively and are not
embedded in source files or returned in reports.

HTTPS certificate validation is not disabled.

Never publish local passwords, authentication cookies,
antiforgery tokens, database credentials or private keys.

## Related documentation

- [Main README](../../README.md)
- [System architecture](../../docs/architecture.md)
- [Docker deployment and CI/CD](../../docs/phase14-docker-cicd.md)
- [Database schema](../../docs/database/README.md)
