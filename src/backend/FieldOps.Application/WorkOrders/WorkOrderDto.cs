using FieldOps.Domain.Enums;

namespace FieldOps.Application.WorkOrders;

public sealed record WorkOrderDto(
    Guid Id,
    Guid FacilityId,
    Guid? AssetId,
    Guid? IncidentId,
    Guid? TechnicianId,
    string Code,
    string Title,
    string? Description,
    WorkOrderPriority Priority,
    WorkOrderStatus Status,
    DateTimeOffset? ScheduledStartUtc,
    DateTimeOffset? DueAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? StartedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    DateTimeOffset? CancelledAtUtc,
    string? CancellationReason);
