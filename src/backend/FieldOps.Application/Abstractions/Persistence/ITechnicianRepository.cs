using FieldOps.Domain.Entities;

namespace FieldOps.Application.Abstractions.Persistence;

public interface ITechnicianRepository
{
    Task<IReadOnlyList<Technician>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<Technician?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsByCodeAsync(
        string code,
        CancellationToken cancellationToken = default);

    Task AddAsync(
        Technician technician,
        CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default);
}
