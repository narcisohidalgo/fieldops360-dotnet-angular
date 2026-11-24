# Database schema — FieldOps 360

The authoritative database schema is managed through **Entity Framework Core migrations**, not by manually combining table-creation scripts.

## Migration history

- `20261120060431_InitialCreate` — creates `Facilities` and `Assets`, relationships and uniqueness constraints.
- `20261123130353_AddIncidents` — adds `Incidents`, with mandatory `FacilityId`, optional `AssetId`, priority/status fields, UTC timestamps and indices.
- `20261123163133_AddIncidentRowVersion` — adds the SQL Server `rowversion` concurrency token to `Incidents`, allowing EF Core to detect conflicting concurrent updates.
- `20261124045123_AddTechnicians` — creates `Technicians`, with a GUID primary key, required code/name/email, optional phone/specialty, active status and a unique index on `Code`.

Technicians are currently independent of Facilities, Assets and Incidents. Technician codes cannot be changed through the update operation. Incident concurrency handling remains unchanged.

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
