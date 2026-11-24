using FieldOps.Domain.Enums;

namespace FieldOps.Application.WorkOrders;

public sealed record CreateWorkOrderCommand(
    Guid FacilityId,
    string Code,
    string Title,
    string? Description,
    WorkOrderPriority Priority,
    Guid? AssetId = null,
    Guid? IncidentId = null,
    Guid? TechnicianId = null,
    DateTimeOffset? ScheduledStartUtc = null,
    DateTimeOffset? DueAtUtc = null);
