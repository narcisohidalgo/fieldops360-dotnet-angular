using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;

namespace FieldOps.Application.Incidents;

public sealed class IncidentService : IIncidentService
{
    private readonly IIncidentRepository _incidentRepository;
    private readonly IFacilityRepository _facilityRepository;
    private readonly IAssetRepository _assetRepository;

    public IncidentService(
        IIncidentRepository incidentRepository,
        IFacilityRepository facilityRepository,
        IAssetRepository assetRepository)
    {
        _incidentRepository = incidentRepository;
        _facilityRepository = facilityRepository;
        _assetRepository = assetRepository;
    }

    public async Task<IReadOnlyList<IncidentDto>> GetAllAsync(
        Guid? facilityId = null,
        Guid? assetId = null,
        IncidentStatus? status = null,
        IncidentPriority? priority = null,
        CancellationToken cancellationToken = default)
    {
        if (facilityId == Guid.Empty)
        {
            throw new ArgumentException(
                "Facility ID cannot be empty.",
                nameof(facilityId));
        }

        if (assetId == Guid.Empty)
        {
            throw new ArgumentException(
                "Asset ID cannot be empty.",
                nameof(assetId));
        }

        if (status.HasValue && !Enum.IsDefined(status.Value))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        if (priority.HasValue && !Enum.IsDefined(priority.Value))
        {
            throw new ArgumentOutOfRangeException(nameof(priority));
        }

        var incidents = await _incidentRepository.GetAllAsync(
            facilityId,
            assetId,
            status,
            priority,
            cancellationToken);

        return incidents.Select(ToDto).ToList();
    }

    public async Task<IncidentDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var incident = await _incidentRepository.GetByIdAsync(
            id,
            cancellationToken);

        return incident is null ? null : ToDto(incident);
    }

    public async Task<IncidentDto> CreateAsync(
        CreateIncidentCommand command,
        CancellationToken cancellationToken = default)
    {
        // Domain validates the incident fields first.
        var incident = new Incident(
            command.FacilityId,
            command.Title,
            command.Description,
            command.Priority,
            command.AssetId);

        // The facility must exist.
        var facility = await _facilityRepository.GetByIdAsync(
            incident.FacilityId,
            cancellationToken);

        if (facility is null)
        {
            throw new IncidentFacilityNotFoundException(
                incident.FacilityId);
        }

        // An optional asset must exist in the same facility.
        if (incident.AssetId.HasValue)
        {
            var assetId = incident.AssetId.Value;

            var asset = await _assetRepository.GetByIdAsync(
                assetId,
                cancellationToken);

            if (asset is null)
            {
                throw new IncidentAssetNotFoundException(assetId);
            }

            if (asset.FacilityId != incident.FacilityId)
            {
                throw new IncidentAssetFacilityMismatchException(
                    assetId,
                    incident.FacilityId);
            }
        }

        await _incidentRepository.AddAsync(
            incident,
            cancellationToken);

        await _incidentRepository.SaveChangesAsync(
            cancellationToken);

        return ToDto(incident);
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateIncidentCommand command,
        CancellationToken cancellationToken = default)
    {
        var incident = await _incidentRepository.GetByIdAsync(
            id,
            cancellationToken);

        if (incident is null)
        {
            return false;
        }

        incident.UpdateDetails(
            command.Title,
            command.Description,
            command.Priority);

        await _incidentRepository.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    public Task<bool> StartProgressAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return ChangeStatusAsync(
            id,
            incident => incident.StartProgress(),
            cancellationToken);
    }

    public Task<bool> ResolveAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return ChangeStatusAsync(
            id,
            incident => incident.Resolve(),
            cancellationToken);
    }

    public Task<bool> CloseAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return ChangeStatusAsync(
            id,
            incident => incident.Close(),
            cancellationToken);
    }

    public Task<bool> ReopenAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return ChangeStatusAsync(
            id,
            incident => incident.Reopen(),
            cancellationToken);
    }

    private async Task<bool> ChangeStatusAsync(
        Guid id,
        Action<Incident> changeStatus,
        CancellationToken cancellationToken)
    {
        var incident = await _incidentRepository.GetByIdAsync(
            id,
            cancellationToken);

        if (incident is null)
        {
            return false;
        }

        // Domain enforces the allowed state transitions.
        changeStatus(incident);

        await _incidentRepository.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    private static IncidentDto ToDto(Incident incident)
    {
        return new IncidentDto(
            incident.Id,
            incident.FacilityId,
            incident.AssetId,
            incident.Title,
            incident.Description,
            incident.Priority,
            incident.Status,
            incident.CreatedAtUtc,
            incident.UpdatedAtUtc,
            incident.ResolvedAtUtc,
            incident.ClosedAtUtc);
    }
}
