# Database schema — FieldOps 360

The authoritative database schema is managed through **Entity Framework Core migrations**, not by manually combining table-creation scripts.

## Migration history

- `20261120060431_InitialCreate` — creates `Facilities` and `Assets`, relationships and uniqueness constraints.
- `20261123130353_AddIncidents` — adds `Incidents`, with mandatory `FacilityId`, optional `AssetId`, priority/status fields, UTC timestamps and indices.
- `20261123163133_AddIncidentRowVersion` — adds the SQL Server `rowversion` concurrency token to `Incidents`, allowing EF Core to detect conflicting concurrent updates.
- `20261124045123_AddTechnicians` — creates `Technicians`, with a GUID primary key, required code/name/email, optional phone/specialty, active status and a unique index on `Code`.
- `20261124064857_AddWorkOrders` — creates `WorkOrders`, with required facility, optional asset/incident/technician relationships, workflow and scheduling fields, UTC timestamps, a unique index on `Code`, query indexes and an EF Core SQL Server `rowversion` concurrency token. Foreign keys use restricted deletion.

Technicians are referenced optionally by Work Orders. Their codes cannot be changed through the technician update operation. Work Orders validate their facility, asset, incident and technician relationships at application level, while SQL Server foreign keys protect referential integrity.

`WorkOrders.Code` is protected by a unique index. SQL Server `rowversion` detects conflicting writes within the EF Core persistence workflow. Explicit client version preconditions are not yet supported, so stale edits from earlier browser sessions are not fully protected.

`InitialCreate.sql` is a historical snapshot **only of the initial migration**. Do not treat it as an up-to-date full-schema export. On a new database, prefer applying all EF Core migrations.

From the repository root, with the SQL Server connection string configured in ASP.NET Core User Secrets:

```powershell
dotnet ef database update --project src/backend/FieldOps.Infrastructure/FieldOps.Infrastructure.csproj --startup-project src/backend/FieldOps.Api/FieldOps.Api.csproj --context FieldOpsDbContext
```

To generate a full idempotent SQL script using your local .NET SDK and `dotnet-ef` installation:

```powershell
dotnet ef migrations script --idempotent --project src/backend/FieldOps.Infrastructure/FieldOps.Infrastructure.csproj --startup-project src/backend/FieldOps.Api/FieldOps.Api.csproj --context FieldOpsDbContext --output docs/database/FullSchema.idempotent.sql
```

Do not apply `InitialCreate.sql` to a database already managed by migrations without first validating the current migration history.
