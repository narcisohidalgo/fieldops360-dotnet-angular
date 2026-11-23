using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Incidents;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Tests.Incidents;

public sealed partial class IncidentServiceTests
{
    [Fact]
    public async Task CreateAsync_WithValidFacilityAndAsset_SavesIncident()
    {
        var test = new TestContext();

        var facility = new Facility(
            "FAC-001",
            "Centro logistico",
            "Cordoba");

        var asset = new Asset(
            facility.Id,
            "EQ-001",
            "Tractor");

        test.Facilities.Items.Add(facility);
        test.Assets.Items.Add(asset);

        var result = await test.Service.CreateAsync(
            new CreateIncidentCommand(
                facility.Id,
                "  Averia del tractor  ",
                "  El motor no arranca  ",
                IncidentPriority.High,
                asset.Id));

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(facility.Id, result.FacilityId);
        Assert.Equal(asset.Id, result.AssetId);
        Assert.Equal("Averia del tractor", result.Title);
        Assert.Equal("El motor no arranca", result.Description);
        Assert.Equal(IncidentPriority.High, result.Priority);
        Assert.Equal(IncidentStatus.Open, result.Status);

        Assert.Null(result.ResolvedAtUtc);
        Assert.Null(result.ClosedAtUtc);

        var saved = Assert.Single(test.Incidents.Items);

        Assert.Equal(result.Id, saved.Id);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithoutAsset_SavesIncident()
    {
        var test = new TestContext();

        var facility = new Facility(
            "FAC-001",
            "Centro logistico",
            "Cordoba");

        test.Facilities.Items.Add(facility);

        var result = await test.Service.CreateAsync(
            new CreateIncidentCommand(
                facility.Id,
                "Fallo electrico",
                null,
                IncidentPriority.Medium));

        Assert.Null(result.AssetId);
        Assert.Null(result.Description);
        Assert.Equal(IncidentStatus.Open, result.Status);

        Assert.Single(test.Incidents.Items);
        Assert.Equal(1, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithUnknownFacility_ThrowsException()
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<IncidentFacilityNotFoundException>(
            () => test.Service.CreateAsync(
                new CreateIncidentCommand(
                    Guid.NewGuid(),
                    "Incidencia",
                    null,
                    IncidentPriority.High)));

        Assert.Empty(test.Incidents.Items);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithUnknownAsset_ThrowsException()
    {
        var test = new TestContext();

        var facility = new Facility(
            "FAC-001",
            "Centro logistico",
            "Cordoba");

        test.Facilities.Items.Add(facility);

        await Assert.ThrowsAsync<IncidentAssetNotFoundException>(
            () => test.Service.CreateAsync(
                new CreateIncidentCommand(
                    facility.Id,
                    "Incidencia",
                    null,
                    IncidentPriority.High,
                    Guid.NewGuid())));

        Assert.Empty(test.Incidents.Items);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithAssetFromDifferentFacility_ThrowsException()
    {
        var test = new TestContext();

        var facilityOne = new Facility(
            "FAC-001",
            "Centro norte",
            "Cordoba");

        var facilityTwo = new Facility(
            "FAC-002",
            "Centro sur",
            "Sevilla");

        var asset = new Asset(
            facilityTwo.Id,
            "EQ-001",
            "Sensor");

        test.Facilities.Items.Add(facilityOne);
        test.Facilities.Items.Add(facilityTwo);
        test.Assets.Items.Add(asset);

        await Assert.ThrowsAsync<IncidentAssetFacilityMismatchException>(
            () => test.Service.CreateAsync(
                new CreateIncidentCommand(
                    facilityOne.Id,
                    "Sensor averiado",
                    null,
                    IncidentPriority.Critical,
                    asset.Id)));

        Assert.Empty(test.Incidents.Items);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithEmptyFacilityId_RejectsCreation()
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentException>(
            () => test.Service.CreateAsync(
                new CreateIncidentCommand(
                    Guid.Empty,
                    "Incidencia",
                    null,
                    IncidentPriority.Low)));

        Assert.Empty(test.Incidents.Items);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithBlankTitle_RejectsCreation()
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentException>(
            () => test.Service.CreateAsync(
                new CreateIncidentCommand(
                    Guid.NewGuid(),
                    "   ",
                    null,
                    IncidentPriority.High)));

        Assert.Empty(test.Incidents.Items);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithInvalidPriority_RejectsCreation()
    {
        var test = new TestContext();

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => test.Service.CreateAsync(
                new CreateIncidentCommand(
                    Guid.NewGuid(),
                    "Incidencia",
                    null,
                    (IncidentPriority)99)));

        Assert.Empty(test.Incidents.Items);
        Assert.Equal(0, test.Incidents.SaveChangesCallCount);
    }

    private sealed class TestContext
    {
        public InMemoryIncidentRepository Incidents { get; } = new();
        public InMemoryFacilityRepository Facilities { get; } = new();
        public InMemoryAssetRepository Assets { get; } = new();

        public IncidentService Service { get; }

        public TestContext()
        {
            Service = new IncidentService(
                Incidents,
                Facilities,
                Assets);
        }
    }

    private sealed class InMemoryIncidentRepository : IIncidentRepository
    {
        public List<Incident> Items { get; } = new();
        public int SaveChangesCallCount { get; private set; }

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
                    i => i.FacilityId == facilityId.Value);
            }

            if (assetId.HasValue)
            {
                query = query.Where(
                    i => i.AssetId == assetId.Value);
            }

            if (status.HasValue)
            {
                query = query.Where(
                    i => i.Status == status.Value);
            }

            if (priority.HasValue)
            {
                query = query.Where(
                    i => i.Priority == priority.Value);
            }

            IReadOnlyList<Incident> results = query
                .OrderByDescending(i => i.CreatedAtUtc)
                .ThenBy(i => i.Id)
                .ToList();

            return Task.FromResult(results);
        }

        public Task<Incident?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.FirstOrDefault(i => i.Id == id));
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
            SaveChangesCallCount++;
            return Task.FromResult(1);
        }
    }

    private sealed class InMemoryFacilityRepository : IFacilityRepository
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
                Items.FirstOrDefault(f => f.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.Any(f => f.Code == code));
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

    private sealed class InMemoryAssetRepository : IAssetRepository
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
                .Where(a => a.FacilityId == facilityId)
                .ToList();

            return Task.FromResult(results);
        }

        public Task<Asset?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.FirstOrDefault(a => a.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            Guid facilityId,
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Items.Any(a =>
                    a.FacilityId == facilityId &&
                    a.Code == code));
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
}
