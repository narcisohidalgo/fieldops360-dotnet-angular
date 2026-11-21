using FieldOps.Domain.Entities;

namespace FieldOps.Application.Abstractions.Persistence;

public interface IFacilityRepository
{
    Task<IReadOnlyList<Facility>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<Facility?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsByCodeAsync(
        string code,
        CancellationToken cancellationToken = default);

    Task AddAsync(
        Facility facility,
        CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default);
}
