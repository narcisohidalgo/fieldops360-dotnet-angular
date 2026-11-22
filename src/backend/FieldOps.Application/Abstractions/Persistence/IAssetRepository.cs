using FieldOps.Domain.Entities;

namespace FieldOps.Application.Abstractions.Persistence;

public interface IAssetRepository
{
    Task<IReadOnlyList<Asset>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Asset>> GetByFacilityIdAsync(
        Guid facilityId,
        CancellationToken cancellationToken = default);

    Task<Asset?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsByCodeAsync(
        Guid facilityId,
        string code,
        CancellationToken cancellationToken = default);

    Task AddAsync(
        Asset asset,
        CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default);
}
