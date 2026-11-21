using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Facilities;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Facilities;

public sealed class FacilityServiceTests
{
    [Fact]
    public async Task CreateAsync_WithValidData_CreatesFacility()
    {
        // Arrange: preparar el repositorio y el servicio.
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var command = new CreateFacilityCommand(
            "FAC-TEST-001",
            "Centro de mantenimiento",
            "Córdoba",
            "Calle Industria 10");

        // Act: ejecutar el caso de uso.
        var result = await service.CreateAsync(command);

        // Assert: comprobar el resultado.
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("FAC-TEST-001", result.Code);
        Assert.Equal("Centro de mantenimiento", result.Name);
        Assert.Equal("Córdoba", result.City);
        Assert.Equal("Calle Industria 10", result.Address);
        Assert.True(result.IsActive);

        var savedFacility = Assert.Single(repository.Facilities);

        Assert.Equal(result.Id, savedFacility.Id);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateCode_ThrowsException()
    {
        // Arrange
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var firstCommand = new CreateFacilityCommand(
            "FAC-TEST-001",
            "Centro de mantenimiento",
            "Córdoba",
            "Calle Industria 10");

        await service.CreateAsync(firstCommand);

        var duplicateCommand = new CreateFacilityCommand(
            "FAC-TEST-001",
            "Otra instalación",
            "Sevilla",
            "Calle Comercio 20");

        // Act & Assert
        await Assert.ThrowsAsync<DuplicateFacilityCodeException>(
            () => service.CreateAsync(duplicateCommand));

        Assert.Single(repository.Facilities);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }
    [Fact]
    public async Task CreateAsync_WithNameTooLong_ThrowsArgumentException()
    {
        // Arrange
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var command = new CreateFacilityCommand(
            "FAC-TEST-002",
            new string('X', 151),
            "Córdoba",
            "Calle Industria 10");

        // Act
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => service.CreateAsync(command));

        // Assert
        Assert.Equal("name", exception.ParamName);
        Assert.Empty(repository.Facilities);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }
    [Fact]
    public async Task UpdateAsync_WithExistingFacility_UpdatesDetailsAndKeepsCode()
    {
        // Arrange
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var createCommand = new CreateFacilityCommand(
            "FAC-TEST-003",
            "Centro original",
            "Córdoba",
            "Calle Original 10");

        var original = await service.CreateAsync(createCommand);

        var updateCommand = new UpdateFacilityCommand(
            "Centro actualizado",
            "Sevilla",
            "Avenida Innovación 25");

        // Act
        var updated = await service.UpdateAsync(
            original.Id,
            updateCommand);

        // Assert
        Assert.True(updated);

        var facility = await service.GetByIdAsync(original.Id);

        Assert.NotNull(facility);
        Assert.Equal(original.Id, facility.Id);
        Assert.Equal("FAC-TEST-003", facility.Code);
        Assert.Equal("Centro actualizado", facility.Name);
        Assert.Equal("Sevilla", facility.City);
        Assert.Equal("Avenida Innovación 25", facility.Address);
        Assert.True(facility.IsActive);

        Assert.Single(repository.Facilities);
        Assert.Equal(2, repository.SaveChangesCallCount);
    }
    [Fact]
    public async Task UpdateAsync_WithNonExistingFacility_ReturnsFalse()
    {
        // Arrange
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var nonExistingId = Guid.NewGuid();

        var updateCommand = new UpdateFacilityCommand(
            "Centro inexistente",
            "Sevilla",
            "Calle Prueba 15");

        // Act
        var updated = await service.UpdateAsync(
            nonExistingId,
            updateCommand);

        // Assert
        Assert.False(updated);
        Assert.Empty(repository.Facilities);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }
    [Fact]
    public async Task DeactivateAsync_WithExistingFacility_SetsIsActiveToFalse()
    {
        // Arrange
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var createCommand = new CreateFacilityCommand(
            "FAC-TEST-004",
            "Centro de mantenimiento",
            "Córdoba",
            "Calle Industria 20");

        var created = await service.CreateAsync(createCommand);

        Assert.True(created.IsActive);

        // Act
        var deactivated = await service.DeactivateAsync(created.Id);

        // Assert
        Assert.True(deactivated);

        var facility = await service.GetByIdAsync(created.Id);

        Assert.NotNull(facility);
        Assert.False(facility.IsActive);

        Assert.Equal(created.Id, facility.Id);
        Assert.Equal("FAC-TEST-004", facility.Code);
        Assert.Equal("Centro de mantenimiento", facility.Name);
        Assert.Equal("Córdoba", facility.City);

        Assert.Single(repository.Facilities);
        Assert.Equal(2, repository.SaveChangesCallCount);
    }
    [Fact]
    public async Task DeactivateAsync_WithNonExistingFacility_ReturnsFalse()
    {
        // Arrange
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var nonExistingId = Guid.NewGuid();

        // Act
        var deactivated = await service.DeactivateAsync(nonExistingId);

        // Assert
        Assert.False(deactivated);
        Assert.Empty(repository.Facilities);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task GetByIdAsync_WithNonExistingFacility_ReturnsNull()
    {
        // Arrange
        var repository = new InMemoryFacilityRepository();
        var service = new FacilityService(repository);

        var nonExistingId = Guid.NewGuid();

        // Act
        var facility = await service.GetByIdAsync(nonExistingId);

        // Assert
        Assert.Null(facility);
        Assert.Empty(repository.Facilities);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }
    private sealed class InMemoryFacilityRepository : IFacilityRepository
    {
        private readonly List<Facility> _facilities = new();

        public IReadOnlyList<Facility> Facilities => _facilities;

        public int SaveChangesCallCount { get; private set; }

        public Task<IReadOnlyList<Facility>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<Facility>>(
                _facilities.ToList());
        }

        public Task<Facility?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<Facility?>(
                _facilities.FirstOrDefault(f => f.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                _facilities.Any(f => f.Code == code));
        }

        public Task AddAsync(
            Facility facility,
            CancellationToken cancellationToken = default)
        {
            _facilities.Add(facility);
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            SaveChangesCallCount++;
            return Task.FromResult(1);
        }
    }
}
