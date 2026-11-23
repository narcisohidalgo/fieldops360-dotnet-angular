using FieldOps.Domain.Enums;

namespace FieldOps.Application.Incidents;

public sealed record CreateIncidentCommand(
    Guid FacilityId,
    string Title,
    string? Description,
    IncidentPriority Priority,
    Guid? AssetId = null);
