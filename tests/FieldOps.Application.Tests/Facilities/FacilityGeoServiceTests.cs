using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Facilities;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Facilities;

public sealed class FacilityGeoServiceTests
{
    [Fact]
    public async Task Create_WithCoordinates_ReturnsCoordinates()
    {
        var repository = new FakeRepository();
        var service = new FacilityService(repository);

        var result = await service.CreateAsync(
            new CreateFacilityCommand(
                "FAC-GEO-1",
                "Centro GIS",
                "Cordoba",
                null,
                37.8882m,
                -4.7794m));

        Assert.Equal(37.8882m, result.Latitude);
        Assert.Equal(-4.7794m, result.Longitude);
        Assert.Single(repository.Items);
        Assert.Equal(1, repository.Saves);
    }

    [Fact]
    public async Task Update_WithCoordinates_PersistsCoordinates()
    {
        var repository = new FakeRepository();
        var service = new FacilityService(repository);

        var created = await service.CreateAsync(
            new CreateFacilityCommand(
                "FAC-GEO-2", "Centro", "Cordoba", null));

        var updated = await service.UpdateAsync(
            created.Id,
            new UpdateFacilityCommand(
                "Centro actualizado",
                "Cordoba",
                null,
                37.8882m,
                -4.7794m));

        Assert.True(updated);

        var result = await service.GetByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Equal(37.8882m, result.Latitude);
        Assert.Equal(-4.7794m, result.Longitude);
        Assert.Equal(2, repository.Saves);
    }

    [Fact]
    public async Task Create_WithIncompleteCoordinates_DoesNotSave()
    {
        var repository = new FakeRepository();
        var service = new FacilityService(repository);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CreateAsync(
                new CreateFacilityCommand(
                    "FAC-GEO-3",
                    "Centro",
                    "Cordoba",
                    null,
                    37m,
                    null)));

        Assert.Empty(repository.Items);
        Assert.Equal(0, repository.Saves);
    }

    [Fact]
    public async Task Update_WithInvalidLatitude_DoesNotSave()
    {
        var repository = new FakeRepository();
        var service = new FacilityService(repository);

        var created = await service.CreateAsync(
            new CreateFacilityCommand(
                "FAC-GEO-4", "Centro", "Cordoba", null));

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => service.UpdateAsync(
                created.Id,
                new UpdateFacilityCommand(
                    "Centro",
                    "Cordoba",
                    null,
                    95m,
                    0m)));

        // Datos generales invalidos tampoco deben cambiar coordenadas.
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UpdateAsync(
                created.Id,
                new UpdateFacilityCommand(
                    " ",
                    "Cordoba",
                    null,
                    36m,
                    -5m)));

        Assert.Equal(1, repository.Saves);

        var result = await service.GetByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Equal("Centro", result.Name);
        Assert.Null(result.Latitude);
        Assert.Null(result.Longitude);
    }

    private sealed class FakeRepository : IFacilityRepository
    {
        public List<Facility> Items { get; } = new();
        public int Saves { get; private set; }

        public Task<IReadOnlyList<Facility>> GetAllAsync(
            CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<Facility>>(Items);

        public Task<Facility?> GetByIdAsync(
            Guid id,
            CancellationToken ct = default) =>
            Task.FromResult(
                Items.FirstOrDefault(x => x.Id == id));

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken ct = default) =>
            Task.FromResult(Items.Any(x => x.Code == code));

        public Task AddAsync(
            Facility facility,
            CancellationToken ct = default)
        {
            Items.Add(facility);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken ct = default)
        {
            Saves++;
            return Task.FromResult(1);
        }
    }
}