using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.WorkOrders;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Tests.WorkOrders;

public sealed class WorkOrderServiceTests
{
    // ==========================================
    // CREATE
    // ==========================================

    [Fact]
    public async Task Create_WithValidReferences_SavesOrder()
    {
        var test = new TestContext();

        var start = DateTimeOffset.UtcNow.AddDays(2);
        var due = start.AddHours(4);

        var result = await test.Service.CreateAsync(
            new CreateWorkOrderCommand(
                test.Facility.Id,
                "  WO-001  ",
                "  Revisar sensor  ",
                "  Mantenimiento preventivo  ",
                WorkOrderPriority.High,
                test.Asset.Id,
                test.Incident.Id,
                test.Technician.Id,
                start,
                due));

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("WO-001", result.Code);
        Assert.Equal("Revisar sensor", result.Title);
        Assert.Equal("Mantenimiento preventivo", result.Description);

        Assert.Equal(test.Facility.Id, result.FacilityId);
        Assert.Equal(test.Asset.Id, result.AssetId);
        Assert.Equal(test.Incident.Id, result.IncidentId);
        Assert.Equal(test.Technician.Id, result.TechnicianId);

        Assert.Equal(WorkOrderPriority.High, result.Priority);
        Assert.Equal(WorkOrderStatus.Planned, result.Status);
        Assert.Equal(start, result.ScheduledStartUtc);
        Assert.Equal(due, result.DueAtUtc);

        Assert.Null(result.StartedAtUtc);
        Assert.Null(result.CompletedAtUtc);
        Assert.Null(result.CancelledAtUtc);

        var saved = Assert.Single(test.Orders.Items);

        Assert.Equal(result.Id, saved.Id);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Create_WithOptionalReferencesNull_Succeeds()
    {
        var test = new TestContext();

        var result = await test.Service.CreateAsync(
            test.Command());

        Assert.Null(result.AssetId);
        Assert.Null(result.IncidentId);
        Assert.Null(result.TechnicianId);
        Assert.Null(result.Description);

        Assert.Single(test.Orders.Items);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Create_WithIncidentOnly_Succeeds()
    {
        var test = new TestContext();

        var result = await test.Service.CreateAsync(
            test.Command(incidentId: test.Incident.Id));

        Assert.Equal(test.Incident.Id, result.IncidentId);
        Assert.Null(result.AssetId);

        Assert.Single(test.Orders.Items);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Create_WithDuplicateTrimmedCode_Throws()
    {
        var test = new TestContext();

        test.SeedOrder(code: "WO-001");

        var before = test.Orders.Items.Count;

        await Assert.ThrowsAsync<DuplicateWorkOrderCodeException>(
            () => test.Service.CreateAsync(
                test.Command(code: "  WO-001  ")));

        Assert.Equal(before, test.Orders.Items.Count);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Create_WithInvalidDomainData_DoesNotSave()
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentException>(
            () => test.Service.CreateAsync(
                new CreateWorkOrderCommand(
                    test.Facility.Id,
                    "WO-001",
                    "   ",
                    null,
                    WorkOrderPriority.High)));

        Assert.Empty(test.Orders.Items);
        Assert.Equal(0, test.Orders.SaveCount);
        Assert.Equal(0, test.Orders.CodeChecks);
    }

    [Fact]
    public async Task Create_WithUnknownFacility_Throws()
    {
        var test = new TestContext();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(facilityId: Guid.NewGuid())));

        Assert.Equal(
            WorkOrderReferenceError.FacilityNotFound,
            error.Error);

        test.AssertNothingSaved();
    }

    [Fact]
    public async Task Create_WithUnknownAsset_Throws()
    {
        var test = new TestContext();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(assetId: Guid.NewGuid())));

        Assert.Equal(
            WorkOrderReferenceError.AssetNotFound,
            error.Error);

        test.AssertNothingSaved();
    }

    [Fact]
    public async Task Create_WithAssetFromAnotherFacility_Throws()
    {
        var test = new TestContext();

        var otherFacility = new Facility(
            "FAC-002", "Centro sur", "Sevilla");

        var otherAsset = new Asset(
            otherFacility.Id, "AS-002", "Compresor");

        test.Facilities.Items.Add(otherFacility);
        test.Assets.Items.Add(otherAsset);

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(assetId: otherAsset.Id)));

        Assert.Equal(
            WorkOrderReferenceError.AssetFacilityMismatch,
            error.Error);

        test.AssertNothingSaved();
    }

    [Fact]
    public async Task Create_WithUnknownIncident_Throws()
    {
        var test = new TestContext();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(incidentId: Guid.NewGuid())));

        Assert.Equal(
            WorkOrderReferenceError.IncidentNotFound,
            error.Error);

        test.AssertNothingSaved();
    }

    [Fact]
    public async Task Create_WithIncidentFromAnotherFacility_Throws()
    {
        var test = new TestContext();

        var otherFacility = new Facility(
            "FAC-002", "Centro sur", "Sevilla");

        var otherIncident = new Incident(
            otherFacility.Id,
            "Incidencia externa",
            null,
            IncidentPriority.High);

        test.Facilities.Items.Add(otherFacility);
        test.Incidents.Items.Add(otherIncident);

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(incidentId: otherIncident.Id)));

        Assert.Equal(
            WorkOrderReferenceError.IncidentFacilityMismatch,
            error.Error);

        test.AssertNothingSaved();
    }

    [Fact]
    public async Task Create_WithConflictingIncidentAndAsset_Throws()
    {
        var test = new TestContext();

        var otherAsset = new Asset(
            test.Facility.Id,
            "AS-002",
            "Otro sensor");

        test.Assets.Items.Add(otherAsset);

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(
                    assetId: otherAsset.Id,
                    incidentId: test.Incident.Id)));

        Assert.Equal(
            WorkOrderReferenceError.IncidentAssetMismatch,
            error.Error);

        test.AssertNothingSaved();
    }

    [Fact]
    public async Task Create_WithUnknownTechnician_Throws()
    {
        var test = new TestContext();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(technicianId: Guid.NewGuid())));

        Assert.Equal(
            WorkOrderReferenceError.TechnicianNotFound,
            error.Error);

        test.AssertNothingSaved();
    }

    [Fact]
    public async Task Create_WithInactiveTechnician_Throws()
    {
        var test = new TestContext();

        test.Technician.Deactivate();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.CreateAsync(
                test.Command(technicianId: test.Technician.Id)));

        Assert.Equal(
            WorkOrderReferenceError.TechnicianInactive,
            error.Error);

        test.AssertNothingSaved();
    }

    // ==========================================
    // QUERY
    // ==========================================

    [Fact]
    public async Task GetAll_WithoutFilters_ReturnsDtos()
    {
        var test = new TestContext();

        var first = test.SeedOrder(
            code: "WO-001",
            technicianId: test.Technician.Id);

        test.SeedOrder(code: "WO-002");

        var results = await test.Service.GetAllAsync();

        Assert.Equal(2, results.Count);
        Assert.Contains(results, x =>
            x.Id == first.Id &&
            x.Code == first.Code &&
            x.TechnicianId == test.Technician.Id);

        Assert.Equal(1, test.Orders.QueryCount);
    }

    [Fact]
    public async Task GetAll_WithFilters_ReturnsMatchingOrder()
    {
        var test = new TestContext();

        var matching = test.SeedOrder(
            code: "WO-001",
            assetId: test.Asset.Id,
            incidentId: test.Incident.Id,
            technicianId: test.Technician.Id);

        test.SeedOrder(code: "WO-002");

        var results = await test.Service.GetAllAsync(
            facilityId: test.Facility.Id,
            assetId: test.Asset.Id,
            incidentId: test.Incident.Id,
            technicianId: test.Technician.Id,
            status: WorkOrderStatus.Planned,
            priority: WorkOrderPriority.Medium);

        var result = Assert.Single(results);

        Assert.Equal(matching.Id, result.Id);
        Assert.Equal(1, test.Orders.QueryCount);
    }

    [Theory]
    [InlineData("facilityId")]
    [InlineData("assetId")]
    [InlineData("incidentId")]
    [InlineData("technicianId")]
    public async Task GetAll_WithEmptyGuidFilter_Rejects(
        string field)
    {
        var test = new TestContext();

        Func<Task> action = field switch
        {
            "facilityId" => () =>
                test.Service.GetAllAsync(facilityId: Guid.Empty),

            "assetId" => () =>
                test.Service.GetAllAsync(assetId: Guid.Empty),

            "incidentId" => () =>
                test.Service.GetAllAsync(incidentId: Guid.Empty),

            "technicianId" => () =>
                test.Service.GetAllAsync(technicianId: Guid.Empty),

            _ => throw new InvalidOperationException()
        };

        var error = await Assert.ThrowsAsync<ArgumentException>(action);

        Assert.Equal(field, error.ParamName);
        Assert.Equal(0, test.Orders.QueryCount);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    [InlineData(-1)]
    public async Task GetAll_WithInvalidStatus_Rejects(int status)
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => test.Service.GetAllAsync(
                status: (WorkOrderStatus)status));

        Assert.Equal(0, test.Orders.QueryCount);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    [InlineData(-1)]
    public async Task GetAll_WithInvalidPriority_Rejects(int priority)
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => test.Service.GetAllAsync(
                priority: (WorkOrderPriority)priority));

        Assert.Equal(0, test.Orders.QueryCount);
    }

    [Fact]
    public async Task GetById_WithExistingOrder_ReturnsDto()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        var result = await test.Service.GetByIdAsync(order.Id);

        Assert.NotNull(result);
        Assert.Equal(order.Id, result.Id);
        Assert.Equal(order.Code, result.Code);
    }

    [Fact]
    public async Task GetById_WithUnknownId_ReturnsNull()
    {
        var test = new TestContext();

        var result = await test.Service.GetByIdAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    // ==========================================
    // UPDATE
    // ==========================================

    [Fact]
    public async Task Update_WhilePlanned_SavesChanges()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        var originalId = order.Id;
        var originalCode = order.Code;
        var originalFacility = order.FacilityId;

        var start = DateTimeOffset.UtcNow.AddDays(3);

        var updated = await test.Service.UpdateAsync(
            order.Id,
            new UpdateWorkOrderCommand(
                "  Revision actualizada  ",
                "  Nuevo detalle  ",
                WorkOrderPriority.Critical,
                start,
                start.AddHours(3)));

        Assert.True(updated);
        Assert.Equal("Revision actualizada", order.Title);
        Assert.Equal("Nuevo detalle", order.Description);
        Assert.Equal(WorkOrderPriority.Critical, order.Priority);

        Assert.Equal(originalId, order.Id);
        Assert.Equal(originalCode, order.Code);
        Assert.Equal(originalFacility, order.FacilityId);

        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Update_WithUnknownId_ReturnsFalse()
    {
        var test = new TestContext();

        var updated = await test.Service.UpdateAsync(
            Guid.NewGuid(),
            new UpdateWorkOrderCommand(
                "Revision",
                null,
                WorkOrderPriority.Medium,
                null,
                null));

        Assert.False(updated);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Update_WithInvalidData_PreservesState()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        var originalTitle = order.Title;
        var originalPriority = order.Priority;

        await Assert.ThrowsAsync<ArgumentException>(
            () => test.Service.UpdateAsync(
                order.Id,
                new UpdateWorkOrderCommand(
                    "   ",
                    null,
                    WorkOrderPriority.Critical,
                    null,
                    null)));

        Assert.Equal(originalTitle, order.Title);
        Assert.Equal(originalPriority, order.Priority);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Update_WhileInProgress_Rejects()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        order.Start();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => test.Service.UpdateAsync(
                order.Id,
                new UpdateWorkOrderCommand(
                    "Otro titulo",
                    null,
                    WorkOrderPriority.High,
                    null,
                    null)));

        Assert.Equal(0, test.Orders.SaveCount);
    }

    // ==========================================
    // ASSIGN TECHNICIAN
    // ==========================================

    [Fact]
    public async Task Assign_WithActiveTechnician_Saves()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        var result = await test.Service.AssignTechnicianAsync(
            order.Id,
            test.Technician.Id);

        Assert.True(result);
        Assert.Equal(test.Technician.Id, order.TechnicianId);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Assign_WithNull_RemovesAssignment()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        var result = await test.Service.AssignTechnicianAsync(
            order.Id,
            null);

        Assert.True(result);
        Assert.Null(order.TechnicianId);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Assign_WithUnknownTechnician_Rejects()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.AssignTechnicianAsync(
                order.Id,
                Guid.NewGuid()));

        Assert.Equal(
            WorkOrderReferenceError.TechnicianNotFound,
            error.Error);

        Assert.Null(order.TechnicianId);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Assign_WithInactiveTechnician_Rejects()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        test.Technician.Deactivate();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.AssignTechnicianAsync(
                order.Id,
                test.Technician.Id));

        Assert.Equal(
            WorkOrderReferenceError.TechnicianInactive,
            error.Error);

        Assert.Null(order.TechnicianId);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Assign_WithEmptyGuid_Rejects()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        var error = await Assert.ThrowsAsync<ArgumentException>(
            () => test.Service.AssignTechnicianAsync(
                order.Id,
                Guid.Empty));

        Assert.Equal("technicianId", error.ParamName);
        Assert.Null(order.TechnicianId);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Assign_WhileInProgress_Rejects()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        order.Start();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => test.Service.AssignTechnicianAsync(
                order.Id,
                Guid.NewGuid()));

        Assert.Equal(test.Technician.Id, order.TechnicianId);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Assign_WithUnknownOrder_ReturnsFalse()
    {
        var test = new TestContext();

        var result = await test.Service.AssignTechnicianAsync(
            Guid.NewGuid(),
            test.Technician.Id);

        Assert.False(result);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    // ==========================================
    // START
    // ==========================================

    [Fact]
    public async Task Start_WithActiveAssignedTechnician_Saves()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        var result = await test.Service.StartAsync(order.Id);

        Assert.True(result);
        Assert.Equal(WorkOrderStatus.InProgress, order.Status);
        Assert.NotNull(order.StartedAtUtc);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Start_WithoutTechnician_Rejects()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => test.Service.StartAsync(order.Id));

        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Start_WithNowInactiveTechnician_Rejects()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        test.Technician.Deactivate();

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.StartAsync(order.Id));

        Assert.Equal(
            WorkOrderReferenceError.TechnicianInactive,
            error.Error);

        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Start_WithMissingTechnician_Rejects()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: Guid.NewGuid());

        var error = await Assert.ThrowsAsync<WorkOrderReferenceException>(
            () => test.Service.StartAsync(order.Id));

        Assert.Equal(
            WorkOrderReferenceError.TechnicianNotFound,
            error.Error);

        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Start_WhileAlreadyInProgress_Rejects()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        order.Start();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => test.Service.StartAsync(order.Id));

        Assert.Equal(0, test.Orders.SaveCount);
    }

    // ==========================================
    // COMPLETE
    // ==========================================

    [Fact]
    public async Task Complete_WhileInProgress_Saves()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        order.Start();

        var result = await test.Service.CompleteAsync(order.Id);

        Assert.True(result);
        Assert.Equal(WorkOrderStatus.Completed, order.Status);
        Assert.NotNull(order.CompletedAtUtc);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Complete_WhilePlanned_Rejects()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => test.Service.CompleteAsync(order.Id));

        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    // ==========================================
    // CANCEL
    // ==========================================

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Cancel_FromAllowedStatus_Saves(bool startFirst)
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        if (startFirst)
        {
            order.Start();
        }

        var result = await test.Service.CancelAsync(
            order.Id,
            "  Equipo fuera de servicio  ");

        Assert.True(result);
        Assert.Equal(WorkOrderStatus.Cancelled, order.Status);
        Assert.Equal(
            "Equipo fuera de servicio",
            order.CancellationReason);

        Assert.NotNull(order.CancelledAtUtc);
        Assert.Equal(1, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Cancel_WithBlankReason_Rejects()
    {
        var test = new TestContext();
        var order = test.SeedOrder();

        await Assert.ThrowsAsync<ArgumentException>(
            () => test.Service.CancelAsync(
                order.Id,
                "   "));

        Assert.Equal(WorkOrderStatus.Planned, order.Status);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    [Fact]
    public async Task Cancel_CompletedOrder_Rejects()
    {
        var test = new TestContext();

        var order = test.SeedOrder(
            technicianId: test.Technician.Id);

        order.Start();
        order.Complete();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => test.Service.CancelAsync(
                order.Id,
                "Cancelar"));

        Assert.Equal(WorkOrderStatus.Completed, order.Status);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    // ==========================================
    // UNKNOWN WORK ORDER
    // ==========================================

    [Theory]
    [InlineData("start")]
    [InlineData("complete")]
    [InlineData("cancel")]
    public async Task Operations_WithUnknownOrder_ReturnFalse(
        string operation)
    {
        var test = new TestContext();
        var missingId = Guid.NewGuid();

        var result = operation switch
        {
            "start" => await test.Service.StartAsync(missingId),
            "complete" => await test.Service.CompleteAsync(missingId),
            "cancel" => await test.Service.CancelAsync(
                missingId, "No disponible"),
            _ => throw new InvalidOperationException()
        };

        Assert.False(result);
        Assert.Equal(0, test.Orders.SaveCount);
    }

    // ==========================================
    // TEST CONTEXT
    // ==========================================

    private sealed class TestContext
    {
        public InMemoryWorkOrderRepository Orders { get; } = new();
        public InMemoryFacilityRepository Facilities { get; } = new();
        public InMemoryAssetRepository Assets { get; } = new();
        public InMemoryIncidentRepository Incidents { get; } = new();
        public InMemoryTechnicianRepository Technicians { get; } = new();

        public Facility Facility { get; }
        public Asset Asset { get; }
        public Incident Incident { get; }
        public Technician Technician { get; }

        public WorkOrderService Service { get; }

        public TestContext()
        {
            Facility = new Facility(
                "FAC-001",
                "Centro de mantenimiento",
                "Cordoba");

            Asset = new Asset(
                Facility.Id,
                "AS-001",
                "Sensor de temperatura");

            Incident = new Incident(
                Facility.Id,
                "Sensor averiado",
                null,
                IncidentPriority.High,
                Asset.Id);

            Technician = new Technician(
                "TEC-001",
                "Ana Lopez",
                "ana@example.com");

            Facilities.Items.Add(Facility);
            Assets.Items.Add(Asset);
            Incidents.Items.Add(Incident);
            Technicians.Items.Add(Technician);

            Service = new WorkOrderService(
                Orders,
                Facilities,
                Assets,
                Incidents,
                Technicians);
        }

        public CreateWorkOrderCommand Command(
            Guid? assetId = null,
            Guid? incidentId = null,
            Guid? technicianId = null,
            Guid? facilityId = null,
            string code = "WO-001")
        {
            return new CreateWorkOrderCommand(
                facilityId ?? Facility.Id,
                code,
                "Revisar equipo",
                null,
                WorkOrderPriority.Medium,
                assetId,
                incidentId,
                technicianId);
        }

        public WorkOrder SeedOrder(
            string code = "WO-001",
            Guid? assetId = null,
            Guid? incidentId = null,
            Guid? technicianId = null)
        {
            var order = new WorkOrder(
                Facility.Id,
                code,
                "Revisar equipo",
                null,
                WorkOrderPriority.Medium,
                assetId,
                incidentId,
                technicianId);

            Orders.Items.Add(order);

            return order;
        }

        public void AssertNothingSaved()
        {
            Assert.Empty(Orders.Items);
            Assert.Equal(0, Orders.SaveCount);
        }
    }

    // ==========================================
    // IN-MEMORY REPOSITORIES
    // ==========================================

    private sealed class InMemoryWorkOrderRepository
        : IWorkOrderRepository
    {
        public List<WorkOrder> Items { get; } = new();

        public int SaveCount { get; private set; }
        public int QueryCount { get; private set; }
        public int CodeChecks { get; private set; }

        public Task<IReadOnlyList<WorkOrder>> GetAllAsync(
            Guid? facilityId = null,
            Guid? assetId = null,
            Guid? incidentId = null,
            Guid? technicianId = null,
            WorkOrderStatus? status = null,
            WorkOrderPriority? priority = null,
            CancellationToken cancellationToken = default)
        {
            QueryCount++;

            IEnumerable<WorkOrder> query = Items;

            if (facilityId.HasValue)
            {
                query = query.Where(
                    x => x.FacilityId == facilityId.Value);
            }

            if (assetId.HasValue)
            {
                query = query.Where(
                    x => x.AssetId == assetId.Value);
            }

            if (incidentId.HasValue)
            {
                query = query.Where(
                    x => x.IncidentId == incidentId.Value);
            }

            if (technicianId.HasValue)
            {
                query = query.Where(
                    x => x.TechnicianId == technicianId.Value);
            }

            if (status.HasValue)
            {
                query = query.Where(
                    x => x.Status == status.Value);
            }

            if (priority.HasValue)
            {
                query = query.Where(
                    x => x.Priority == priority.Value);
            }

            IReadOnlyList<WorkOrder> results = query
                .OrderByDescending(x => x.CreatedAtUtc)
                .ThenBy(x => x.Id)
                .ToList();

            return Task.FromResult(results);
        }

        public Task<WorkOrder?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.FirstOrDefault(x => x.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken cancellationToken = default)
        {
            CodeChecks++;

            return Task.FromResult(
                Items.Any(x => x.Code == code));
        }

        public Task AddAsync(
            WorkOrder workOrder,
            CancellationToken cancellationToken = default)
        {
            Items.Add(workOrder);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            SaveCount++;
            return Task.FromResult(1);
        }
    }

    private sealed class InMemoryFacilityRepository
        : IFacilityRepository
    {
        public List<Facility> Items { get; } = new();

        public Task<IReadOnlyList<Facility>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            IReadOnlyList<Facility> results = Items.ToList();
            return Task.FromResult(results);
        }

        public Task<Facility?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.FirstOrDefault(x => x.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.Any(x => x.Code == code));
        }

        public Task AddAsync(
            Facility facility,
            CancellationToken cancellationToken = default)
        {
            Items.Add(facility);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(1);
        }
    }

    private sealed class InMemoryAssetRepository
        : IAssetRepository
    {
        public List<Asset> Items { get; } = new();

        public Task<IReadOnlyList<Asset>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            IReadOnlyList<Asset> results = Items.ToList();
            return Task.FromResult(results);
        }

        public Task<IReadOnlyList<Asset>> GetByFacilityIdAsync(
            Guid facilityId,
            CancellationToken cancellationToken = default)
        {
            IReadOnlyList<Asset> results = Items
                .Where(x => x.FacilityId == facilityId)
                .ToList();

            return Task.FromResult(results);
        }

        public Task<Asset?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.FirstOrDefault(x => x.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            Guid facilityId,
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.Any(x =>
                    x.FacilityId == facilityId &&
                    x.Code == code));
        }

        public Task AddAsync(
            Asset asset,
            CancellationToken cancellationToken = default)
        {
            Items.Add(asset);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(1);
        }
    }

    private sealed class InMemoryIncidentRepository
        : IIncidentRepository
    {
        public List<Incident> Items { get; } = new();

        public Task<IReadOnlyList<Incident>> GetAllAsync(
            Guid? facilityId = null,
            Guid? assetId = null,
            IncidentStatus? status = null,
            IncidentPriority? priority = null,
            CancellationToken cancellationToken = default)
        {
            IEnumerable<Incident> query = Items;

            if (facilityId.HasValue)
            {
                query = query.Where(
                    x => x.FacilityId == facilityId.Value);
            }

            if (assetId.HasValue)
            {
                query = query.Where(
                    x => x.AssetId == assetId.Value);
            }

            if (status.HasValue)
            {
                query = query.Where(
                    x => x.Status == status.Value);
            }

            if (priority.HasValue)
            {
                query = query.Where(
                    x => x.Priority == priority.Value);
            }

            IReadOnlyList<Incident> results = query.ToList();

            return Task.FromResult(results);
        }

        public Task<Incident?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.FirstOrDefault(x => x.Id == id));
        }

        public Task AddAsync(
            Incident incident,
            CancellationToken cancellationToken = default)
        {
            Items.Add(incident);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(1);
        }
    }

    private sealed class InMemoryTechnicianRepository
        : ITechnicianRepository
    {
        public List<Technician> Items { get; } = new();

        public Task<IReadOnlyList<Technician>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            IReadOnlyList<Technician> results = Items.ToList();

            return Task.FromResult(results);
        }

        public Task<Technician?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.FirstOrDefault(x => x.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.Any(x => x.Code == code));
        }

        public Task AddAsync(
            Technician technician,
            CancellationToken cancellationToken = default)
        {
            Items.Add(technician);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(1);
        }
    }
}
