using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Security;
using FieldOps.Application.WorkOrders;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class MyWorkOrdersSecurityTests
{
    private const string Route = "/api/my/work-orders";

    [SqlServerFact]
    public async Task Technician_CanOnlyAccessAndModifyOwnOrders()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        var first = new Technician(
            "TEC-001", "First Technician",
            "first@example.invalid");

        var second = new Technician(
            "TEC-002", "Second Technician",
            "second@example.invalid");

        var own = new WorkOrder(
            facility.Id, "WO-001", "Own order",
            null, WorkOrderPriority.High,
            technicianId: first.Id);

        var foreign = new WorkOrder(
            facility.Id, "WO-002", "Foreign order",
            null, WorkOrderPriority.High,
            technicianId: second.Id);

        var unassigned = new WorkOrder(
            facility.Id, "WO-003", "Unassigned order",
            null, WorkOrderPriority.Medium);

        await using (var db = database.CreateContext())
        {
            db.Facilities.Add(facility);
            db.Technicians.AddRange(first, second);
            db.WorkOrders.AddRange(own, foreign, unassigned);

            await db.SaveChangesAsync();
        }

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Technician, first.Id);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        // La lista contiene exclusivamente las ordenes propias.
        var orders = await client
            .GetFromJsonAsync<WorkOrderDto[]>(Route);

        Assert.NotNull(orders);
        Assert.Equal(own.Id, Assert.Single(orders).Id);

        // Manipular el filtro no cambia la identidad autenticada.
        var manipulated = await client
            .GetFromJsonAsync<WorkOrderDto[]>(
                $"{Route}?technicianId={second.Id}");

        Assert.NotNull(manipulated);
        Assert.Equal(own.Id, Assert.Single(manipulated).Id);

        var ownUrl = $"{Route}/{own.Id}";

        var ownDetails =
            await client.GetFromJsonAsync<WorkOrderDto>(ownUrl);

        Assert.NotNull(ownDetails);
        Assert.Equal(first.Id, ownDetails.TechnicianId);

        // Las ordenes ajenas, sin asignar e inexistentes
        // deben producir la misma respuesta: HTTP 404.
        foreach (var id in new[]
        {
            foreign.Id,
            unassigned.Id,
            Guid.NewGuid()
        })
        {
            using var read = await client.GetAsync(
                $"{Route}/{id}");

            Assert.Equal(HttpStatusCode.NotFound, read.StatusCode);

            using var start = await client.PatchAsync(
                $"{Route}/{id}/start", null);

            Assert.Equal(HttpStatusCode.NotFound, start.StatusCode);

            using var complete = await client.PatchAsync(
                $"{Route}/{id}/complete", null);

            Assert.Equal(
                HttpStatusCode.NotFound, complete.StatusCode);
        }

        // No se permite completar una orden planificada.
        using var invalidComplete = await client.PatchAsync(
            $"{ownUrl}/complete", null);

        Assert.Equal(
            HttpStatusCode.Conflict, invalidComplete.StatusCode);

        // La orden propia puede iniciarse y completarse.
        using var started = await client.PatchAsync(
            $"{ownUrl}/start", null);

        Assert.Equal(HttpStatusCode.NoContent, started.StatusCode);

        var inProgress = await client
            .GetFromJsonAsync<WorkOrderDto>(ownUrl);

        Assert.NotNull(inProgress);
        Assert.Equal(
            WorkOrderStatus.InProgress, inProgress.Status);

        using var completed = await client.PatchAsync(
            $"{ownUrl}/complete", null);

        Assert.Equal(
            HttpStatusCode.NoContent, completed.StatusCode);

        // Verificar el estado persistido de las tres ordenes.
        await using var verification = database.CreateContext();

        var persisted = await verification.WorkOrders
            .ToDictionaryAsync(item => item.Id);

        Assert.Equal(3, persisted.Count);

        Assert.Equal(
            WorkOrderStatus.Completed, persisted[own.Id].Status);

        Assert.NotNull(persisted[own.Id].StartedAtUtc);
        Assert.NotNull(persisted[own.Id].CompletedAtUtc);

        foreach (var id in new[] { foreign.Id, unassigned.Id })
        {
            Assert.Equal(
                WorkOrderStatus.Planned, persisted[id].Status);

            Assert.Null(persisted[id].StartedAtUtc);
            Assert.Null(persisted[id].CompletedAtUtc);
        }
    }

    [SqlServerFact]
    public async Task IneligibleUsers_CannotAccessMyWorkOrders()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        var inactive = new Technician(
            "TEC-001", "Inactive Technician",
            "inactive@example.invalid");

        inactive.Deactivate();

        var order = new WorkOrder(
            facility.Id, "WO-001", "Test order",
            null, WorkOrderPriority.High,
            technicianId: inactive.Id);

        await using (var db = database.CreateContext())
        {
            db.Facilities.Add(facility);
            db.Technicians.Add(inactive);
            db.WorkOrders.Add(order);

            await db.SaveChangesAsync();
        }

        var users = new[]
        {
            await factory.CreateUserAsync(
                FieldOpsRoles.Technician, inactive.Id),

            await factory.CreateUserAsync(
                FieldOpsRoles.Technician),

            await factory.CreateUserAsync(
                FieldOpsRoles.Supervisor)
        };

        foreach (var user in users)
        {
            using var client = factory.CreateSessionClient();

            await SqlServerApiFactory.LoginAsync(
                client, user.Email, user.Password);

            using var list = await client.GetAsync(Route);

            Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);

            using var read = await client.GetAsync(
                $"{Route}/{order.Id}");

            Assert.Equal(HttpStatusCode.Forbidden, read.StatusCode);

            using var start = await client.PatchAsync(
                $"{Route}/{order.Id}/start", null);

            Assert.Equal(HttpStatusCode.Forbidden, start.StatusCode);

            using var complete = await client.PatchAsync(
                $"{Route}/{order.Id}/complete", null);

            Assert.Equal(
                HttpStatusCode.Forbidden, complete.StatusCode);
        }

        await using var verification = database.CreateContext();

        var stored = await verification.WorkOrders.SingleAsync();

        Assert.Equal(WorkOrderStatus.Planned, stored.Status);
        Assert.Null(stored.StartedAtUtc);
        Assert.Null(stored.CompletedAtUtc);
    }
}
