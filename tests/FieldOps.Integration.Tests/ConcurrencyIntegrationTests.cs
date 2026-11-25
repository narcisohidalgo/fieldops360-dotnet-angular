using FieldOps.Application.Incidents;
using FieldOps.Application.WorkOrders;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Persistence.Repositories;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class ConcurrencyIntegrationTests
{
    [SqlServerFact]
    public async Task Incident_ConcurrentUpdate_IsRejected()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        var incident = new Incident(
            facility.Id, "Original incident",
            null, IncidentPriority.Medium);

        await using (var db = database.CreateContext())
        {
            await db.Database.MigrateAsync();

            db.Facilities.Add(facility);
            db.Incidents.Add(incident);

            await db.SaveChangesAsync();
        }

        await using var firstDb = database.CreateContext();
        await using var secondDb = database.CreateContext();

        var firstRepository = new IncidentRepository(firstDb);
        var secondRepository = new IncidentRepository(secondDb);

        var first = await firstRepository.GetByIdAsync(incident.Id);
        var second = await secondRepository.GetByIdAsync(incident.Id);

        Assert.NotNull(first);
        Assert.NotNull(second);

        first.StartProgress();

        await firstRepository.SaveChangesAsync();

        second.UpdateDetails(
            "Obsolete update", null, IncidentPriority.High);

        var exception =
            await Assert.ThrowsAsync<IncidentConcurrencyException>(
                async () => await secondRepository.SaveChangesAsync());

        Assert.IsType<DbUpdateConcurrencyException>(
            exception.InnerException);

        await using var verification = database.CreateContext();

        var stored = await verification.Incidents.SingleAsync(
            item => item.Id == incident.Id);

        Assert.Equal(IncidentStatus.InProgress, stored.Status);
        Assert.Equal("Original incident", stored.Title);
        Assert.Equal(IncidentPriority.Medium, stored.Priority);
    }

    [SqlServerFact]
    public async Task WorkOrder_ConcurrentUpdate_IsRejected()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        var technician = new Technician(
            "TEC-001", "Test Technician",
            "technician@example.invalid");

        var order = new WorkOrder(
            facility.Id, "WO-001", "Original work order",
            null, WorkOrderPriority.Medium,
            technicianId: technician.Id);

        await using (var db = database.CreateContext())
        {
            await db.Database.MigrateAsync();

            db.Facilities.Add(facility);
            db.Technicians.Add(technician);
            db.WorkOrders.Add(order);

            await db.SaveChangesAsync();
        }

        await using var firstDb = database.CreateContext();
        await using var secondDb = database.CreateContext();

        var firstRepository = new WorkOrderRepository(firstDb);
        var secondRepository = new WorkOrderRepository(secondDb);

        var first = await firstRepository.GetByIdAsync(order.Id);
        var second = await secondRepository.GetByIdAsync(order.Id);

        Assert.NotNull(first);
        Assert.NotNull(second);

        first.Start();

        await firstRepository.SaveChangesAsync();

        second.Cancel("Obsolete cancellation");

        var exception =
            await Assert.ThrowsAsync<WorkOrderConcurrencyException>(
                async () => await secondRepository.SaveChangesAsync());

        Assert.IsType<DbUpdateConcurrencyException>(
            exception.InnerException);

        await using var verification = database.CreateContext();

        var stored = await verification.WorkOrders.SingleAsync(
            item => item.Id == order.Id);

        Assert.Equal(WorkOrderStatus.InProgress, stored.Status);
        Assert.NotNull(stored.StartedAtUtc);
        Assert.Null(stored.CancelledAtUtc);
        Assert.Null(stored.CancellationReason);
    }

    [SqlServerFact]
    public async Task WorkOrder_DuplicateCode_ThrowsApplicationException()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        await db.Database.MigrateAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        db.Facilities.Add(facility);

        await db.SaveChangesAsync();

        var repository = new WorkOrderRepository(db);

        await repository.AddAsync(new WorkOrder(
            facility.Id, "WO-001", "First order",
            null, WorkOrderPriority.Medium));

        await repository.SaveChangesAsync();

        await repository.AddAsync(new WorkOrder(
            facility.Id, "WO-001", "Duplicate order",
            null, WorkOrderPriority.High));

        await Assert.ThrowsAsync<DuplicateWorkOrderCodeException>(
            async () => await repository.SaveChangesAsync());

        await using var verification = database.CreateContext();

        var stored = await verification.WorkOrders.SingleAsync(
            item => item.Code == "WO-001");

        Assert.Equal("First order", stored.Title);
    }

    [SqlServerFact]
    public async Task Technician_DuplicateCode_IsRejected()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        await db.Database.MigrateAsync();

        db.Technicians.Add(new Technician(
            "TEC-001", "Technician A",
            "first@example.invalid"));

        await db.SaveChangesAsync();

        db.Technicians.Add(new Technician(
            "TEC-001", "Technician B",
            "second@example.invalid"));

        var exception =
            await Assert.ThrowsAsync<DbUpdateException>(
                async () => await db.SaveChangesAsync());

        var sqlException =
            Assert.IsType<SqlException>(exception.InnerException);

        Assert.Contains(sqlException.Number, new[] { 2601, 2627 });

        await using var verification = database.CreateContext();

        var stored = await verification.Technicians.SingleAsync(
            item => item.Code == "TEC-001");

        Assert.Equal("Technician A", stored.Name);
    }
}
