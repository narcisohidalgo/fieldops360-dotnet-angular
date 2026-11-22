using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Assets;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Assets;

public sealed class AssetServiceTests
{
    [Fact]
    public async Task CreateAsync_WithValidData_CreatesAsset()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facility = CreateFacility("FAC-001");
        facilities.Facilities.Add(facility);

        var service = new AssetService(assets, facilities);

        var result = await service.CreateAsync(
            new CreateAssetCommand(
                facility.Id,
                " EQ-001 ",
                " Tractor agricola ",
                " Equipo de mantenimiento "));

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(facility.Id, result.FacilityId);
        Assert.Equal("EQ-001", result.Code);
        Assert.Equal("Tractor agricola", result.Name);
        Assert.Equal("Equipo de mantenimiento", result.Description);
        Assert.True(result.IsActive);

        var savedAsset = Assert.Single(assets.Assets);

        Assert.Equal(result.Id, savedAsset.Id);
        Assert.Equal(1, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithUnknownFacility_ThrowsException()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();
        var service = new AssetService(assets, facilities);

        var facilityId = Guid.NewGuid();

        await Assert.ThrowsAsync<AssetFacilityNotFoundException>(
            () => service.CreateAsync(
                new CreateAssetCommand(
                    facilityId,
                    "EQ-001",
                    "Tractor",
                    null)));

        Assert.Empty(assets.Assets);
        Assert.Equal(0, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateCodeInSameFacility_ThrowsException()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facility = CreateFacility("FAC-001");

        facilities.Facilities.Add(facility);

        assets.Assets.Add(
            new Asset(
                facility.Id,
                "EQ-001",
                "Tractor existente"));

        var service = new AssetService(assets, facilities);

        await Assert.ThrowsAsync<DuplicateAssetCodeException>(
            () => service.CreateAsync(
                new CreateAssetCommand(
                    facility.Id,
                    " EQ-001 ",
                    "Otro tractor",
                    null)));

        Assert.Single(assets.Assets);
        Assert.Equal(0, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithSameCodeInDifferentFacilities_Succeeds()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facilityOne = CreateFacility("FAC-001");
        var facilityTwo = CreateFacility("FAC-002");

        facilities.Facilities.AddRange([
            facilityOne,
            facilityTwo
        ]);

        assets.Assets.Add(
            new Asset(
                facilityOne.Id,
                "EQ-001",
                "Tractor de la primera instalacion"));

        var service = new AssetService(assets, facilities);

        var result = await service.CreateAsync(
            new CreateAssetCommand(
                facilityTwo.Id,
                "EQ-001",
                "Tractor de la segunda instalacion",
                null));

        Assert.Equal("EQ-001", result.Code);
        Assert.Equal(facilityTwo.Id, result.FacilityId);
        Assert.Equal(2, assets.Assets.Count);
        Assert.Equal(1, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithInvalidName_DoesNotSaveAsset()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facility = CreateFacility("FAC-001");
        facilities.Facilities.Add(facility);

        var service = new AssetService(assets, facilities);

        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => service.CreateAsync(
                new CreateAssetCommand(
                    facility.Id,
                    "EQ-001",
                    "   ",
                    null)));

        Assert.Equal("name", exception.ParamName);
        Assert.Empty(assets.Assets);
        Assert.Equal(0, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllAssets()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facilityOne = CreateFacility("FAC-001");
        var facilityTwo = CreateFacility("FAC-002");

        assets.Assets.AddRange([
            new Asset(facilityOne.Id, "EQ-001", "Tractor"),
            new Asset(facilityTwo.Id, "EQ-002", "Sensor")
        ]);

        var service = new AssetService(assets, facilities);

        var result = await service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, a => a.Code == "EQ-001");
        Assert.Contains(result, a => a.Code == "EQ-002");
    }

    [Fact]
    public async Task GetByFacilityIdAsync_ReturnsOnlyMatchingAssets()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facilityOne = CreateFacility("FAC-001");
        var facilityTwo = CreateFacility("FAC-002");

        assets.Assets.AddRange([
            new Asset(facilityOne.Id, "EQ-001", "Tractor"),
            new Asset(facilityOne.Id, "EQ-002", "Sensor"),
            new Asset(facilityTwo.Id, "EQ-003", "Bomba")
        ]);

        var service = new AssetService(assets, facilities);

        var result = await service.GetByFacilityIdAsync(
            facilityOne.Id);

        Assert.Equal(2, result.Count);
        Assert.All(
            result,
            asset => Assert.Equal(
                facilityOne.Id,
                asset.FacilityId));

        Assert.DoesNotContain(
            result,
            asset => asset.Code == "EQ-003");
    }

    [Fact]
    public async Task GetByIdAsync_WithExistingAsset_ReturnsDto()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facility = CreateFacility("FAC-001");

        var existingAsset = new Asset(
            facility.Id,
            "EQ-001",
            "Tractor",
            "Equipo agricola");

        assets.Assets.Add(existingAsset);

        var service = new AssetService(assets, facilities);

        var result = await service.GetByIdAsync(existingAsset.Id);

        Assert.NotNull(result);
        Assert.Equal(existingAsset.Id, result.Id);
        Assert.Equal(facility.Id, result.FacilityId);
        Assert.Equal("EQ-001", result.Code);
        Assert.Equal("Tractor", result.Name);
        Assert.Equal("Equipo agricola", result.Description);
        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task GetByIdAsync_WithUnknownAsset_ReturnsNull()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var service = new AssetService(assets, facilities);

        var result = await service.GetByIdAsync(Guid.NewGuid());

        Assert.Null(result);
        Assert.Empty(assets.Assets);
    }

    [Fact]
    public async Task UpdateAsync_WithExistingAsset_UpdatesDetails()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facility = CreateFacility("FAC-001");

        var asset = new Asset(
            facility.Id,
            "EQ-001",
            "Tractor original",
            "Descripcion original");

        assets.Assets.Add(asset);

        var service = new AssetService(assets, facilities);

        var updated = await service.UpdateAsync(
            asset.Id,
            new UpdateAssetCommand(
                "Tractor actualizado",
                "Equipo de mantenimiento"));

        Assert.True(updated);

        var result = await service.GetByIdAsync(asset.Id);

        Assert.NotNull(result);
        Assert.Equal(asset.Id, result.Id);
        Assert.Equal(facility.Id, result.FacilityId);
        Assert.Equal("EQ-001", result.Code);
        Assert.Equal("Tractor actualizado", result.Name);
        Assert.Equal("Equipo de mantenimiento", result.Description);
        Assert.True(result.IsActive);

        Assert.Single(assets.Assets);
        Assert.Equal(1, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WithUnknownAsset_ReturnsFalse()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var service = new AssetService(assets, facilities);

        var updated = await service.UpdateAsync(
            Guid.NewGuid(),
            new UpdateAssetCommand(
                "Tractor actualizado",
                "Nueva descripcion"));

        Assert.False(updated);
        Assert.Empty(assets.Assets);
        Assert.Equal(0, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WithInvalidName_DoesNotSaveChanges()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var asset = new Asset(
            Guid.NewGuid(),
            "EQ-001",
            "Tractor original",
            "Descripcion original");

        assets.Assets.Add(asset);

        var service = new AssetService(assets, facilities);

        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => service.UpdateAsync(
                asset.Id,
                new UpdateAssetCommand(
                    "   ",
                    "Descripcion modificada")));

        Assert.Equal("name", exception.ParamName);

        Assert.Equal("Tractor original", asset.Name);
        Assert.Equal("Descripcion original", asset.Description);
        Assert.Equal(0, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task DeactivateAsync_WithExistingAsset_SetsIsActiveToFalse()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facility = CreateFacility("FAC-001");

        var asset = new Asset(
            facility.Id,
            "EQ-001",
            "Tractor agricola",
            "Equipo de mantenimiento");

        assets.Assets.Add(asset);

        var service = new AssetService(assets, facilities);

        // Act
        var deactivated = await service.DeactivateAsync(asset.Id);

        // Assert
        Assert.True(deactivated);

        var result = await service.GetByIdAsync(asset.Id);

        Assert.NotNull(result);
        Assert.False(result.IsActive);

        Assert.Equal(asset.Id, result.Id);
        Assert.Equal(facility.Id, result.FacilityId);
        Assert.Equal("EQ-001", result.Code);
        Assert.Equal("Tractor agricola", result.Name);
        Assert.Equal("Equipo de mantenimiento", result.Description);

        Assert.Single(assets.Assets);
        Assert.Equal(1, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task DeactivateAsync_WithUnknownAsset_ReturnsFalse()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var service = new AssetService(assets, facilities);

        var deactivated = await service.DeactivateAsync(
            Guid.NewGuid());

        Assert.False(deactivated);
        Assert.Empty(assets.Assets);
        Assert.Equal(0, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task ActivateAsync_WithInactiveAsset_SetsIsActiveToTrue()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var facility = CreateFacility("FAC-001");

        var asset = new Asset(
            facility.Id,
            "EQ-001",
            "Tractor agricola",
            "Equipo de mantenimiento");

        asset.Deactivate();

        Assert.False(asset.IsActive);

        assets.Assets.Add(asset);

        var service = new AssetService(assets, facilities);

        // Act
        var activated = await service.ActivateAsync(asset.Id);

        // Assert
        Assert.True(activated);

        var result = await service.GetByIdAsync(asset.Id);

        Assert.NotNull(result);
        Assert.True(result.IsActive);

        Assert.Equal(asset.Id, result.Id);
        Assert.Equal(facility.Id, result.FacilityId);
        Assert.Equal("EQ-001", result.Code);
        Assert.Equal("Tractor agricola", result.Name);
        Assert.Equal("Equipo de mantenimiento", result.Description);

        Assert.Single(assets.Assets);
        Assert.Equal(1, assets.SaveChangesCallCount);
    }

    [Fact]
    public async Task ActivateAsync_WithUnknownAsset_ReturnsFalse()
    {
        var facilities = new InMemoryFacilityRepository();
        var assets = new InMemoryAssetRepository();

        var service = new AssetService(assets, facilities);

        var activated = await service.ActivateAsync(
            Guid.NewGuid());

        Assert.False(activated);
        Assert.Empty(assets.Assets);
        Assert.Equal(0, assets.SaveChangesCallCount);
    }

    private static Facility CreateFacility(string code)
    {
        return new Facility(
            code,
            "Centro de operaciones",
            "Cordoba",
            "Calle Industria 10");
    }

    private sealed class InMemoryAssetRepository : IAssetRepository
    {
        public List<Asset> Assets { get; } = [];

        public int SaveChangesCallCount { get; private set; }

        public Task<IReadOnlyList<Asset>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<Asset>>(
                Assets.ToList());
        }

        public Task<IReadOnlyList<Asset>> GetByFacilityIdAsync(
            Guid facilityId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<Asset>>(
                Assets
                    .Where(a => a.FacilityId == facilityId)
                    .ToList());
        }

        public Task<Asset?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<Asset?>(
                Assets.FirstOrDefault(a => a.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            Guid facilityId,
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Assets.Any(
                    a => a.FacilityId == facilityId &&
                         a.Code == code));
        }

        public Task AddAsync(
            Asset asset,
            CancellationToken cancellationToken = default)
        {
            Assets.Add(asset);
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
        public List<Facility> Facilities { get; } = [];

        public Task<IReadOnlyList<Facility>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<Facility>>(
                Facilities.ToList());
        }

        public Task<Facility?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<Facility?>(
                Facilities.FirstOrDefault(f => f.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Facilities.Any(f => f.Code == code));
        }

        public Task AddAsync(
            Facility facility,
            CancellationToken cancellationToken = default)
        {
            Facilities.Add(facility);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(1);
        }
    }
}
