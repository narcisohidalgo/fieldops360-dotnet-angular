using FieldOps.Domain.Enums;

namespace FieldOps.Application.Incidents;

public sealed record IncidentDto(
    Guid Id,
    Guid FacilityId,
    Guid? AssetId,
    string Title,
    string? Description,
    IncidentPriority Priority,
    IncidentStatus Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ResolvedAtUtc,
    DateTimeOffset? ClosedAtUtc);
