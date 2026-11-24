using FieldOps.Domain.Enums;

namespace FieldOps.Application.WorkOrders;

public sealed record UpdateWorkOrderCommand(
    string Title,
    string? Description,
    WorkOrderPriority Priority,
    DateTimeOffset? ScheduledStartUtc,
    DateTimeOffset? DueAtUtc);
