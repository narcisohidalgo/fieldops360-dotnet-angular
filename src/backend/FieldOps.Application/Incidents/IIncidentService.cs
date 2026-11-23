using FieldOps.Domain.Enums;

namespace FieldOps.Application.Incidents;

public interface IIncidentService
{
    Task<IReadOnlyList<IncidentDto>> GetAllAsync(
        Guid? facilityId = null,
        Guid? assetId = null,
        IncidentStatus? status = null,
        IncidentPriority? priority = null,
        CancellationToken cancellationToken = default);

    Task<IncidentDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<IncidentDto> CreateAsync(
        CreateIncidentCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(
        Guid id,
        UpdateIncidentCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> StartProgressAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> ResolveAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> CloseAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> ReopenAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}
