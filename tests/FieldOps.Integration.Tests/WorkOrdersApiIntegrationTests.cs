using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Security;
using FieldOps.Application.WorkOrders;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class WorkOrdersApiIntegrationTests
{
    private const string Route = "/api/work-orders";

    private static async Task<(
        Guid FacilityId,
        Guid AssetId,
        Guid IncidentId,
        Guid TechnicianId,
        Guid InactiveTechnicianId,
        Guid OtherFacilityId)> SeedAsync(
            SqlServerTestDatabase database)
    {
        await using var db = database.CreateContext();

        var facility = new Facility(
            "FAC-001", "Facility A", "Cordoba");

        var other = new Facility(
            "FAC-002", "Facility B", "Sevilla");

        var asset = new Asset(
            facility.Id, "AST-001", "Test Asset");

        var incident = new Incident(
            facility.Id, "Test Incident",
            null, IncidentPriority.High, asset.Id);

        var technician = new Technician(
            "TEC-001", "Active Technician",
            "active@example.invalid");

        var inactive = new Technician(
            "TEC-002", "Inactive Technician",
            "inactive@example.invalid");

        inactive.Deactivate();

        db.Facilities.AddRange(facility, other);
        db.Assets.Add(asset);
        db.Incidents.Add(incident);
        db.Technicians.AddRange(technician, inactive);

        await db.SaveChangesAsync();

        return (
            facility.Id,
            asset.Id,
            incident.Id,
            technician.Id,
            inactive.Id,
            other.Id);
    }

    [SqlServerFact]
    public async Task Supervisor_CanManageWorkOrderLifecycle()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var seed = await SeedAsync(database);

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var scheduled = new DateTimeOffset(
            2030, 1, 10, 8, 0, 0, TimeSpan.Zero);

        var due = scheduled.AddHours(4);

        var command = new CreateWorkOrderCommand(
            seed.FacilityId,
            "WO-001",
            "Equipment maintenance",
            "Initial description",
            WorkOrderPriority.Medium,
            AssetId: seed.AssetId,
            IncidentId: seed.IncidentId,
            ScheduledStartUtc: scheduled,
            DueAtUtc: due);

        using var created = await client.PostAsJsonAsync(
            Route, command);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var order = await created.Content
            .ReadFromJsonAsync<WorkOrderDto>();

        Assert.NotNull(order);
        Assert.NotEqual(Guid.Empty, order.Id);
        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Equal(seed.FacilityId, order.FacilityId);
        Assert.Equal(seed.AssetId, order.AssetId);
        Assert.Equal(seed.IncidentId, order.IncidentId);
        Assert.Null(order.TechnicianId);
        Assert.Equal(scheduled, order.ScheduledStartUtc);
        Assert.Equal(due, order.DueAtUtc);

        Assert.NotNull(created.Headers.Location);

        using var read = await client.GetAsync(
            created.Headers.Location);

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);

        Assert.Equal(order,
            await read.Content.ReadFromJsonAsync<WorkOrderDto>());

        var url = $"{Route}/{order.Id}";

        // No se puede iniciar sin un tecnico asignado.
        using var unassignedStart = await client.PatchAsync(
            $"{url}/start", null);

        Assert.Equal(
            HttpStatusCode.Conflict, unassignedStart.StatusCode);

        var update = new UpdateWorkOrderCommand(
            "Updated maintenance",
            "Updated description",
            WorkOrderPriority.High,
            scheduled,
            due.AddHours(2));

        using var updated = await client.PutAsJsonAsync(
            url, update);

        Assert.Equal(
            HttpStatusCode.NoContent, updated.StatusCode);

        using var assigned = await client.PatchAsJsonAsync(
            $"{url}/assign-technician",
            new { technicianId = seed.TechnicianId });

        Assert.Equal(
            HttpStatusCode.NoContent, assigned.StatusCode);

        using var started = await client.PatchAsync(
            $"{url}/start", null);

        Assert.Equal(
            HttpStatusCode.NoContent, started.StatusCode);

        var inProgress =
            await client.GetFromJsonAsync<WorkOrderDto>(url);

        Assert.NotNull(inProgress);
        Assert.Equal(
            WorkOrderStatus.InProgress, inProgress.Status);

        Assert.NotNull(inProgress.StartedAtUtc);
        Assert.Equal(seed.TechnicianId, inProgress.TechnicianId);

        using var completed = await client.PatchAsync(
            $"{url}/complete", null);

        Assert.Equal(
            HttpStatusCode.NoContent, completed.StatusCode);

        var final = await client.GetFromJsonAsync<WorkOrderDto>(
            url);

        Assert.NotNull(final);
        Assert.Equal(WorkOrderStatus.Completed, final.Status);
        Assert.NotNull(final.CompletedAtUtc);
        Assert.Equal(update.Title, final.Title);
        Assert.Equal(update.Priority, final.Priority);
        Assert.Equal(update.DueAtUtc, final.DueAtUtc);

        // Crear una segunda orden para comprobar los filtros.
        using var second = await client.PostAsJsonAsync(
            Route, command with
            {
                Code = "WO-002",
                TechnicianId = seed.TechnicianId
            });

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);

        var filtered = await client.GetFromJsonAsync<WorkOrderDto[]>(
            $"{Route}?facilityId={seed.FacilityId}" +
            $"&assetId={seed.AssetId}" +
            $"&incidentId={seed.IncidentId}" +
            $"&technicianId={seed.TechnicianId}" +
            "&status=Completed&priority=High");

        Assert.NotNull(filtered);
        Assert.Equal(order.Id, Assert.Single(filtered).Id);

        // Una orden completada no puede cancelarse.
        using var invalidCancel = await client.PatchAsJsonAsync(
            $"{url}/cancel", new { reason = "Invalid cancellation" });

        Assert.Equal(
            HttpStatusCode.Conflict, invalidCancel.StatusCode);

        await using var db = database.CreateContext();

        var persisted = await db.WorkOrders.SingleAsync(
            item => item.Id == order.Id);

        Assert.Equal(WorkOrderStatus.Completed, persisted.Status);
        Assert.Equal(seed.TechnicianId, persisted.TechnicianId);
        Assert.Equal(update.Title, persisted.Title);
        Assert.NotNull(persisted.StartedAtUtc);
        Assert.NotNull(persisted.CompletedAtUtc);
        Assert.Null(persisted.CancelledAtUtc);
    }

    [SqlServerFact]
    public async Task InvalidReferencesAndCancellation_ReturnExpectedResults()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var seed = await SeedAsync(database);

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var valid = new CreateWorkOrderCommand(
            seed.FacilityId,
            "WO-001",
            "Test work order",
            null,
            WorkOrderPriority.Medium,
            AssetId: seed.AssetId,
            IncidentId: seed.IncidentId,
            TechnicianId: seed.TechnicianId);

        var invalidCases =
            new (CreateWorkOrderCommand Command,
                 HttpStatusCode Expected)[]
        {
            (valid with { FacilityId = Guid.NewGuid() },
                HttpStatusCode.NotFound),

            (valid with { AssetId = Guid.NewGuid() },
                HttpStatusCode.NotFound),

            (valid with { IncidentId = Guid.NewGuid() },
                HttpStatusCode.NotFound),

            (valid with { TechnicianId = Guid.NewGuid() },
                HttpStatusCode.NotFound),

            (valid with { FacilityId = seed.OtherFacilityId },
                HttpStatusCode.BadRequest),

            (valid with
                {
                    FacilityId = seed.OtherFacilityId,
                    AssetId = null
                },
                HttpStatusCode.BadRequest),

            (valid with
                {
                    TechnicianId = seed.InactiveTechnicianId
                },
                HttpStatusCode.Conflict),

            (valid with { Priority = (WorkOrderPriority)999 },
                HttpStatusCode.BadRequest),

            (valid with
                {
                    ScheduledStartUtc = DateTimeOffset.UtcNow,
                    DueAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
                },
                HttpStatusCode.BadRequest)
        };

        foreach (var item in invalidCases)
        {
            using var response = await client.PostAsJsonAsync(
                Route, item.Command);

            Assert.Equal(item.Expected, response.StatusCode);
        }

        using var created = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var order = await created.Content
            .ReadFromJsonAsync<WorkOrderDto>();

        Assert.NotNull(order);

        using var duplicate = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(
            HttpStatusCode.Conflict, duplicate.StatusCode);

        var url = $"{Route}/{order.Id}";

        using var inactiveAssignment = await client.PatchAsJsonAsync(
            $"{url}/assign-technician",
            new { technicianId = seed.InactiveTechnicianId });

        Assert.Equal(
            HttpStatusCode.Conflict, inactiveAssignment.StatusCode);

        using var invalidComplete = await client.PatchAsync(
            $"{url}/complete", null);

        Assert.Equal(
            HttpStatusCode.Conflict, invalidComplete.StatusCode);

        using var invalidCancel = await client.PatchAsJsonAsync(
            $"{url}/cancel", new { reason = "" });

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidCancel.StatusCode);

        using var cancelled = await client.PatchAsJsonAsync(
            $"{url}/cancel",
            new { reason = "Maintenance no longer required" });

        Assert.Equal(
            HttpStatusCode.NoContent, cancelled.StatusCode);

        var final = await client.GetFromJsonAsync<WorkOrderDto>(
            url);

        Assert.NotNull(final);
        Assert.Equal(WorkOrderStatus.Cancelled, final.Status);
        Assert.NotNull(final.CancelledAtUtc);
        Assert.Equal(
            "Maintenance no longer required",
            final.CancellationReason);

        using var missing = await client.GetAsync(
            $"{Route}/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        using var invalidFilter = await client.GetAsync(
            $"{Route}?priority=999");

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidFilter.StatusCode);

        await using var db = database.CreateContext();

        var persisted = await db.WorkOrders.SingleAsync();

        Assert.Equal(order.Id, persisted.Id);
        Assert.Equal(WorkOrderStatus.Cancelled, persisted.Status);
        Assert.Equal(seed.TechnicianId, persisted.TechnicianId);
        Assert.Equal(final.CancellationReason,
            persisted.CancellationReason);
    }
}
