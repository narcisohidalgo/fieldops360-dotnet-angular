using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Abstractions.Persistence;

public interface IIncidentRepository
{
    Task<IReadOnlyList<Incident>> GetAllAsync(
        Guid? facilityId = null,
        Guid? assetId = null,
        IncidentStatus? status = null,
        IncidentPriority? priority = null,
        CancellationToken cancellationToken = default);

    Task<Incident?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task AddAsync(
        Incident incident,
        CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default);
}
