using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Tests.WorkOrders;

public sealed class WorkOrderTests
{
    [Fact]
    public void Constructor_WithValidData_CreatesPlannedOrder()
    {
        var facilityId = Guid.NewGuid();
        var assetId = Guid.NewGuid();
        var incidentId = Guid.NewGuid();
        var technicianId = Guid.NewGuid();

        var scheduled = new DateTimeOffset(
            2026, 12, 1, 9, 0, 0, TimeSpan.Zero);

        var due = scheduled.AddHours(4);

        var before = DateTimeOffset.UtcNow;

        var order = new WorkOrder(
            facilityId,
            "  WO-001  ",
            "  Revisar sistema electrico  ",
            "  Inspeccion preventiva  ",
            WorkOrderPriority.High,
            assetId,
            incidentId,
            technicianId,
            scheduled,
            due);

        var after = DateTimeOffset.UtcNow;

        Assert.NotEqual(Guid.Empty, order.Id);
        Assert.Equal(facilityId, order.FacilityId);
        Assert.Equal(assetId, order.AssetId);
        Assert.Equal(incidentId, order.IncidentId);
        Assert.Equal(technicianId, order.TechnicianId);

        Assert.Equal("WO-001", order.Code);
        Assert.Equal("Revisar sistema electrico", order.Title);
        Assert.Equal("Inspeccion preventiva", order.Description);

        Assert.Equal(WorkOrderPriority.High, order.Priority);
        Assert.Equal(WorkOrderStatus.Planned, order.Status);

        Assert.Equal(scheduled, order.ScheduledStartUtc);
        Assert.Equal(due, order.DueAtUtc);

        Assert.InRange(order.CreatedAtUtc, before, after);
        Assert.Equal(order.CreatedAtUtc, order.UpdatedAtUtc);

        Assert.Null(order.StartedAtUtc);
        Assert.Null(order.CompletedAtUtc);
        Assert.Null(order.CancelledAtUtc);
        Assert.Null(order.CancellationReason);
    }

    [Fact]
    public void Constructor_WithoutOptionalFields_StoresNull()
    {
        var order = CreateOrder();

        Assert.Null(order.AssetId);
        Assert.Null(order.IncidentId);
        Assert.Null(order.TechnicianId);
        Assert.Null(order.ScheduledStartUtc);
        Assert.Null(order.DueAtUtc);
        Assert.Null(order.Description);
    }

    [Fact]
    public void Constructor_WithEmptyFacility_Throws()
    {
        var error = Assert.Throws<ArgumentException>(
            () => new WorkOrder(
                Guid.Empty,
                "WO-001",
                "Revisar equipo",
                null,
                WorkOrderPriority.Medium));

        Assert.Equal("facilityId", error.ParamName);
    }

    [Theory]
    [InlineData("assetId")]
    [InlineData("incidentId")]
    [InlineData("technicianId")]
    public void Constructor_WithEmptyOptionalId_Throws(string field)
    {
        var error = Assert.Throws<ArgumentException>(
            () => new WorkOrder(
                Guid.NewGuid(),
                "WO-001",
                "Revisar equipo",
                null,
                WorkOrderPriority.Medium,
                assetId: field == "assetId" ? Guid.Empty : null,
                incidentId: field == "incidentId" ? Guid.Empty : null,
                technicianId: field == "technicianId" ? Guid.Empty : null));

        Assert.Equal(field, error.ParamName);
    }

    [Theory]
    [InlineData("", "Titulo", "code")]
    [InlineData("WO-001", "   ", "title")]
    public void Constructor_WithBlankRequiredField_Throws(
        string code,
        string title,
        string parameter)
    {
        var error = Assert.Throws<ArgumentException>(
            () => new WorkOrder(
                Guid.NewGuid(),
                code,
                title,
                null,
                WorkOrderPriority.Medium));

        Assert.Equal(parameter, error.ParamName);
    }

    [Fact]
    public void Constructor_WithOverlongCode_Throws()
    {
        var error = Assert.Throws<ArgumentException>(
            () => new WorkOrder(
                Guid.NewGuid(),
                new string('C', 31),
                "Revisar equipo",
                null,
                WorkOrderPriority.Medium));

        Assert.Equal("code", error.ParamName);
    }

    [Fact]
    public void Constructor_WithOverlongTitle_Throws()
    {
        var error = Assert.Throws<ArgumentException>(
            () => new WorkOrder(
                Guid.NewGuid(),
                "WO-001",
                new string('T', 151),
                null,
                WorkOrderPriority.Medium));

        Assert.Equal("title", error.ParamName);
    }

    [Fact]
    public void Constructor_WithOverlongDescription_Throws()
    {
        var error = Assert.Throws<ArgumentException>(
            () => new WorkOrder(
                Guid.NewGuid(),
                "WO-001",
                "Revisar equipo",
                new string('D', 2001),
                WorkOrderPriority.Medium));

        Assert.Equal("description", error.ParamName);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    [InlineData(-1)]
    public void Constructor_WithInvalidPriority_Throws(int value)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => new WorkOrder(
                Guid.NewGuid(),
                "WO-001",
                "Revisar equipo",
                null,
                (WorkOrderPriority)value));
    }

    [Fact]
    public void Constructor_WithInvalidSchedule_Throws()
    {
        var start = DateTimeOffset.UtcNow.AddDays(2);
        var due = start.AddHours(-1);

        var error = Assert.Throws<ArgumentException>(
            () => new WorkOrder(
                Guid.NewGuid(),
                "WO-001",
                "Revisar equipo",
                null,
                WorkOrderPriority.Medium,
                scheduledStartUtc: start,
                dueAtUtc: due));

        Assert.Equal("dueAtUtc", error.ParamName);
    }

    [Fact]
    public void Constructor_WithTimeZoneOffset_NormalizesToUtc()
    {
        var start = new DateTimeOffset(
            2026, 12, 1, 10, 0, 0, TimeSpan.FromHours(1));

        var order = new WorkOrder(
            Guid.NewGuid(),
            "WO-001",
            "Revisar equipo",
            null,
            WorkOrderPriority.Medium,
            scheduledStartUtc: start);

        Assert.Equal(TimeSpan.Zero, order.ScheduledStartUtc!.Value.Offset);
        Assert.Equal(start.ToUniversalTime(), order.ScheduledStartUtc);
    }

    [Fact]
    public void UpdateDetails_WhilePlanned_UpdatesFields()
    {
        var order = CreateOrder();
        var originalId = order.Id;
        var originalCode = order.Code;
        var originalFacilityId = order.FacilityId;
        var originalCreatedAt = order.CreatedAtUtc;

        var start = DateTimeOffset.UtcNow.AddDays(3);
        var due = start.AddHours(5);

        order.UpdateDetails(
            "  Revision actualizada  ",
            "  Nuevo detalle  ",
            WorkOrderPriority.Critical,
            start,
            due);

        Assert.Equal("Revision actualizada", order.Title);
        Assert.Equal("Nuevo detalle", order.Description);
        Assert.Equal(WorkOrderPriority.Critical, order.Priority);
        Assert.Equal(start, order.ScheduledStartUtc);
        Assert.Equal(due, order.DueAtUtc);

        Assert.Equal(originalId, order.Id);
        Assert.Equal(originalCode, order.Code);
        Assert.Equal(originalFacilityId, order.FacilityId);
        Assert.Equal(originalCreatedAt, order.CreatedAtUtc);
        Assert.True(order.UpdatedAtUtc >= originalCreatedAt);
    }

    [Fact]
    public void UpdateDetails_WithBlankDescription_StoresNull()
    {
        var order = CreateOrder();

        order.UpdateDetails(
            "Nuevo titulo",
            "  ",
            WorkOrderPriority.Low,
            null,
            null);

        Assert.Null(order.Description);
    }

    [Theory]
    [InlineData("title")]
    [InlineData("description")]
    [InlineData("priority")]
    [InlineData("schedule")]
    public void UpdateDetails_WithInvalidInput_PreservesState(
        string invalidField)
    {
        var order = CreateOrder();

        var before = (
            order.Title,
            order.Description,
            order.Priority,
            order.ScheduledStartUtc,
            order.DueAtUtc,
            order.UpdatedAtUtc);

        var start = DateTimeOffset.UtcNow.AddDays(2);

        Assert.ThrowsAny<ArgumentException>(() =>
            order.UpdateDetails(
                invalidField == "title"
                    ? "  "
                    : "Nuevo titulo",
                invalidField == "description"
                    ? new string('X', 2001)
                    : "Nuevo detalle",
                invalidField == "priority"
                    ? (WorkOrderPriority)99
                    : WorkOrderPriority.High,
                start,
                invalidField == "schedule"
                    ? start.AddHours(-1)
                    : start.AddHours(2)));

        var after = (
            order.Title,
            order.Description,
            order.Priority,
            order.ScheduledStartUtc,
            order.DueAtUtc,
            order.UpdatedAtUtc);

        Assert.Equal(before, after);
    }

    [Fact]
    public void AssignTechnician_WithValidId_UpdatesAssignment()
    {
        var order = CreateOrder();
        var technicianId = Guid.NewGuid();

        order.AssignTechnician(technicianId);

        Assert.Equal(technicianId, order.TechnicianId);
    }

    [Fact]
    public void AssignTechnician_WithNull_RemovesAssignment()
    {
        var order = CreateOrderWithTechnician();

        order.AssignTechnician(null);

        Assert.Null(order.TechnicianId);
    }

    [Fact]
    public void AssignTechnician_WithEmptyId_PreservesAssignment()
    {
        var order = CreateOrderWithTechnician();
        var previousId = order.TechnicianId;

        var error = Assert.Throws<ArgumentException>(
            () => order.AssignTechnician(Guid.Empty));

        Assert.Equal("technicianId", error.ParamName);
        Assert.Equal(previousId, order.TechnicianId);
    }

    [Fact]
    public void Start_WithoutTechnician_ThrowsAndPreservesState()
    {
        var order = CreateOrder();

        Assert.Throws<InvalidOperationException>(
            () => order.Start());

        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Null(order.StartedAtUtc);
    }

    [Fact]
    public void Start_WithTechnician_StartsWorkOrder()
    {
        var order = CreateOrderWithTechnician();

        var before = DateTimeOffset.UtcNow;

        order.Start();

        var after = DateTimeOffset.UtcNow;

        Assert.Equal(WorkOrderStatus.InProgress, order.Status);
        Assert.NotNull(order.StartedAtUtc);
        Assert.InRange(order.StartedAtUtc!.Value, before, after);
        Assert.Equal(order.StartedAtUtc, order.UpdatedAtUtc);
    }

    [Fact]
    public void Start_Twice_Throws()
    {
        var order = CreateOrderWithTechnician();
        order.Start();

        Assert.Throws<InvalidOperationException>(
            () => order.Start());
    }

    [Fact]
    public void AssignTechnician_WhileInProgress_Throws()
    {
        var order = CreateOrderWithTechnician();
        var originalId = order.TechnicianId;

        order.Start();

        Assert.Throws<InvalidOperationException>(
            () => order.AssignTechnician(Guid.NewGuid()));

        Assert.Equal(originalId, order.TechnicianId);
    }

    [Fact]
    public void UpdateDetails_WhileInProgress_Throws()
    {
        var order = CreateOrderWithTechnician();
        order.Start();

        Assert.Throws<InvalidOperationException>(
            () => order.UpdateDetails(
                "Titulo nuevo",
                null,
                WorkOrderPriority.Low,
                null,
                null));
    }

    [Fact]
    public void Complete_WhileInProgress_CompletesWorkOrder()
    {
        var order = CreateOrderWithTechnician();
        order.Start();

        var before = DateTimeOffset.UtcNow;

        order.Complete();

        var after = DateTimeOffset.UtcNow;

        Assert.Equal(WorkOrderStatus.Completed, order.Status);
        Assert.NotNull(order.CompletedAtUtc);
        Assert.InRange(order.CompletedAtUtc!.Value, before, after);
        Assert.Equal(order.CompletedAtUtc, order.UpdatedAtUtc);
        Assert.Null(order.CancelledAtUtc);
    }

    [Fact]
    public void Complete_WhilePlanned_Throws()
    {
        var order = CreateOrder();

        Assert.Throws<InvalidOperationException>(
            () => order.Complete());

        Assert.Equal(WorkOrderStatus.Planned, order.Status);
    }

    [Fact]
    public void Cancel_WhilePlanned_CancelsWorkOrder()
    {
        var order = CreateOrder();

        order.Cancel("  Trabajo no necesario  ");

        Assert.Equal(WorkOrderStatus.Cancelled, order.Status);
        Assert.Equal("Trabajo no necesario", order.CancellationReason);
        Assert.NotNull(order.CancelledAtUtc);
        Assert.Equal(order.CancelledAtUtc, order.UpdatedAtUtc);
    }

    [Fact]
    public void Cancel_WhileInProgress_CancelsWorkOrder()
    {
        var order = CreateOrderWithTechnician();
        order.Start();

        order.Cancel("Equipo fuera de servicio");

        Assert.Equal(WorkOrderStatus.Cancelled, order.Status);
        Assert.NotNull(order.StartedAtUtc);
        Assert.NotNull(order.CancelledAtUtc);
        Assert.Null(order.CompletedAtUtc);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Cancel_WithBlankReason_Throws(string reason)
    {
        var order = CreateOrder();

        var error = Assert.Throws<ArgumentException>(
            () => order.Cancel(reason));

        Assert.Equal("reason", error.ParamName);
        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Null(order.CancelledAtUtc);
    }

    [Fact]
    public void Cancel_WithOverlongReason_Throws()
    {
        var order = CreateOrder();

        var error = Assert.Throws<ArgumentException>(
            () => order.Cancel(new string('X', 501)));

        Assert.Equal("reason", error.ParamName);
        Assert.Equal(WorkOrderStatus.Planned, order.Status);
    }

    [Fact]
    public void CompletedOrder_CannotBeCancelledOrModified()
    {
        var order = CreateOrderWithTechnician();

        order.Start();
        order.Complete();

        Assert.Throws<InvalidOperationException>(
            () => order.Cancel("Cancelar"));

        Assert.Throws<InvalidOperationException>(
            () => order.AssignTechnician(Guid.NewGuid()));

        Assert.Throws<InvalidOperationException>(
            () => order.UpdateDetails(
                "Otro titulo",
                null,
                WorkOrderPriority.High,
                null,
                null));

        Assert.Equal(WorkOrderStatus.Completed, order.Status);
    }

    [Fact]
    public void CancelledOrder_CannotBeRestartedOrCompleted()
    {
        var order = CreateOrderWithTechnician();

        order.Cancel("Cancelacion de prueba");

        Assert.Throws<InvalidOperationException>(
            () => order.Start());

        Assert.Throws<InvalidOperationException>(
            () => order.Complete());

        Assert.Throws<InvalidOperationException>(
            () => order.Cancel("Otra cancelacion"));

        Assert.Equal(WorkOrderStatus.Cancelled, order.Status);
    }

    private static WorkOrder CreateOrder()
    {
        return new WorkOrder(
            Guid.NewGuid(),
            "WO-001",
            "Revisar equipo",
            null,
            WorkOrderPriority.Medium);
    }

    private static WorkOrder CreateOrderWithTechnician()
    {
        return new WorkOrder(
            Guid.NewGuid(),
            "WO-001",
            "Revisar equipo",
            null,
            WorkOrderPriority.Medium,
            technicianId: Guid.NewGuid());
    }
}
