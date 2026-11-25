namespace FieldOps.Application.Dashboard;

public sealed record DashboardEntityCountsDto(
    int Total,
    int Active);

public sealed record DashboardIncidentCountsDto(
    int Total,
    int Open,
    int InProgress,
    int Resolved,
    int Closed);

public sealed record DashboardWorkOrderCountsDto(
    int Total,
    int Planned,
    int InProgress,
    int Completed,
    int Cancelled,
    int Overdue,
    int UnassignedPlanned);

public sealed record DashboardSummaryDto(
    DashboardEntityCountsDto Facilities,
    DashboardEntityCountsDto Assets,
    DashboardEntityCountsDto Technicians,
    DashboardIncidentCountsDto Incidents,
    DashboardWorkOrderCountsDto WorkOrders,
    DateTimeOffset GeneratedAtUtc);