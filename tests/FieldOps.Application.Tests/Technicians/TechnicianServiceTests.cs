using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Technicians;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Tests.Technicians;

public sealed class TechnicianServiceTests
{
    [Fact]
    public async Task CreateAsync_WithValidData_CreatesTechnician()
    {
        var repo = new InMemoryTechnicianRepository();
        var service = new TechnicianService(repo);

        var result = await service.CreateAsync(
            new CreateTechnicianCommand(
                " TEC-001 ",
                " Ana Lopez ",
                " ana@example.com ",
                " 600123456 ",
                " Electricidad "));

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("TEC-001", result.Code);
        Assert.Equal("Ana Lopez", result.Name);
        Assert.Equal("ana@example.com", result.Email);
        Assert.Equal("600123456", result.Phone);
        Assert.Equal("Electricidad", result.Specialty);
        Assert.True(result.IsActive);

        Assert.Equal(result.Id, Assert.Single(repo.Technicians).Id);
        Assert.Equal(1, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateCode_Throws()
    {
        var repo = new InMemoryTechnicianRepository();
        repo.Technicians.Add(CreateTechnician());

        var service = new TechnicianService(repo);

        await Assert.ThrowsAsync<DuplicateTechnicianCodeException>(
            () => service.CreateAsync(
                new CreateTechnicianCommand(
                    " TEC-001 ", "Luis", "luis@example.com",
                    null, null)));

        Assert.Single(repo.Technicians);
        Assert.Equal(0, repo.SaveChangesCallCount);
    }

    [Theory]
    [InlineData(" ", "ana@example.com", "name")]
    [InlineData("Ana", "invalid-email", "email")]
    public async Task CreateAsync_WithInvalidData_DoesNotPersist(
        string name, string email, string parameter)
    {
        var repo = new InMemoryTechnicianRepository();
        var service = new TechnicianService(repo);

        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => service.CreateAsync(
                new CreateTechnicianCommand(
                    "TEC-001", name, email, null, null)));

        Assert.Equal(parameter, exception.ParamName);
        Assert.Empty(repo.Technicians);
        Assert.Equal(0, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task GetAllAsync_WithEmptyRepository_ReturnsEmpty()
    {
        var service = new TechnicianService(
            new InMemoryTechnicianRepository());

        var result = await service.GetAllAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAllAsync_WithTechnicians_ReturnsDtos()
    {
        var repo = new InMemoryTechnicianRepository();
        repo.Technicians.Add(CreateTechnician());
        repo.Technicians.Add(new Technician(
            "TEC-002", "Luis Garcia", "luis@example.com"));

        var service = new TechnicianService(repo);

        var result = await service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, t => t.Code == "TEC-001");
        Assert.Contains(result, t => t.Code == "TEC-002");
        Assert.Equal(0, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task GetByIdAsync_WithExistingTechnician_ReturnsDto()
    {
        var repo = new InMemoryTechnicianRepository();
        var technician = CreateTechnician();
        repo.Technicians.Add(technician);

        var service = new TechnicianService(repo);

        var result = await service.GetByIdAsync(technician.Id);

        Assert.NotNull(result);
        Assert.Equal(technician.Id, result.Id);
        Assert.Equal(technician.Code, result.Code);
        Assert.Equal(technician.Email, result.Email);
    }

    [Fact]
    public async Task GetByIdAsync_WithUnknownId_ReturnsNull()
    {
        var service = new TechnicianService(
            new InMemoryTechnicianRepository());

        var result = await service.GetByIdAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateAsync_WithValidData_UpdatesDetails()
    {
        var repo = new InMemoryTechnicianRepository();
        var technician = CreateTechnician();
        repo.Technicians.Add(technician);

        var service = new TechnicianService(repo);

        var updated = await service.UpdateAsync(
            technician.Id,
            new UpdateTechnicianCommand(
                " Luis Garcia ",
                " luis@example.com ",
                "699123456",
                "Mecanica"));

        Assert.True(updated);
        Assert.Equal("Luis Garcia", technician.Name);
        Assert.Equal("luis@example.com", technician.Email);
        Assert.Equal("699123456", technician.Phone);
        Assert.Equal("Mecanica", technician.Specialty);
        Assert.Equal("TEC-001", technician.Code);
        Assert.Equal(1, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WithInvalidEmail_PreservesData()
    {
        var repo = new InMemoryTechnicianRepository();
        var technician = CreateTechnician();
        repo.Technicians.Add(technician);

        var service = new TechnicianService(repo);

        var before = (
            technician.Name,
            technician.Email,
            technician.Phone,
            technician.Specialty);

        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => service.UpdateAsync(
                technician.Id,
                new UpdateTechnicianCommand(
                    "Luis Garcia", "invalid-email",
                    "699123456", "Mecanica")));

        Assert.Equal("email", exception.ParamName);

        var after = (
            technician.Name,
            technician.Email,
            technician.Phone,
            technician.Specialty);

        Assert.Equal(before, after);
        Assert.Equal(0, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WithBlankOptionalFields_StoresNull()
    {
        var repo = new InMemoryTechnicianRepository();
        var technician = CreateTechnician();
        repo.Technicians.Add(technician);

        var service = new TechnicianService(repo);

        var updated = await service.UpdateAsync(
            technician.Id,
            new UpdateTechnicianCommand(
                "Ana Lopez", "ana@example.com", " ", " "));

        Assert.True(updated);
        Assert.Null(technician.Phone);
        Assert.Null(technician.Specialty);
        Assert.Equal(1, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WithUnknownId_ReturnsFalse()
    {
        var repo = new InMemoryTechnicianRepository();
        var service = new TechnicianService(repo);

        var result = await service.UpdateAsync(
            Guid.NewGuid(),
            new UpdateTechnicianCommand(
                "Ana", "ana@example.com", null, null));

        Assert.False(result);
        Assert.Equal(0, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task DeactivateAsync_WithExistingTechnician_SetsInactive()
    {
        var repo = new InMemoryTechnicianRepository();
        var technician = CreateTechnician();
        repo.Technicians.Add(technician);

        var service = new TechnicianService(repo);

        var result = await service.DeactivateAsync(technician.Id);

        Assert.True(result);
        Assert.False(technician.IsActive);
        Assert.Equal(1, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task ActivateAsync_WithInactiveTechnician_SetsActive()
    {
        var repo = new InMemoryTechnicianRepository();
        var technician = CreateTechnician();
        technician.Deactivate();
        repo.Technicians.Add(technician);

        var service = new TechnicianService(repo);

        var result = await service.ActivateAsync(technician.Id);

        Assert.True(result);
        Assert.True(technician.IsActive);
        Assert.Equal(1, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task DeactivateAsync_WithUnknownId_ReturnsFalse()
    {
        var repo = new InMemoryTechnicianRepository();
        var service = new TechnicianService(repo);

        var result = await service.DeactivateAsync(Guid.NewGuid());

        Assert.False(result);
        Assert.Equal(0, repo.SaveChangesCallCount);
    }

    [Fact]
    public async Task ActivateAsync_WithUnknownId_ReturnsFalse()
    {
        var repo = new InMemoryTechnicianRepository();
        var service = new TechnicianService(repo);

        var result = await service.ActivateAsync(Guid.NewGuid());

        Assert.False(result);
        Assert.Equal(0, repo.SaveChangesCallCount);
    }

    private static Technician CreateTechnician()
    {
        return new Technician(
            "TEC-001",
            "Ana Lopez",
            "ana@example.com",
            "600123456",
            "Electricidad");
    }

    private sealed class InMemoryTechnicianRepository
        : ITechnicianRepository
    {
        public List<Technician> Technicians { get; } = new();

        public int SaveChangesCallCount { get; private set; }

        public Task<IReadOnlyList<Technician>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<Technician>>(
                Technicians.ToList());
        }

        public Task<Technician?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<Technician?>(
                Technicians.FirstOrDefault(t => t.Id == id));
        }

        public Task<bool> ExistsByCodeAsync(
            string code,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                Technicians.Any(t =>
                    string.Equals(
                        t.Code, code,
                        StringComparison.OrdinalIgnoreCase)));
        }

        public Task AddAsync(
            Technician technician,
            CancellationToken cancellationToken = default)
        {
            Technicians.Add(technician);
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
