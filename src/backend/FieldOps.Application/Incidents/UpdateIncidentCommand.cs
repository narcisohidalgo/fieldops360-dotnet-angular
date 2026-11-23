using FieldOps.Domain.Enums;

namespace FieldOps.Application.Incidents;

public sealed record UpdateIncidentCommand(
    string Title,
    string? Description,
    IncidentPriority Priority);
