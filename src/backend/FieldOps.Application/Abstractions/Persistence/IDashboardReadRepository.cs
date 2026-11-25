using FieldOps.Application.Dashboard;

namespace FieldOps.Application.Abstractions.Persistence;

public interface IDashboardReadRepository
{
    Task<DashboardEntityCountsDto> GetFacilityCountsAsync(
        CancellationToken cancellationToken = default);

    Task<DashboardEntityCountsDto> GetAssetCountsAsync(
        CancellationToken cancellationToken = default);

    Task<DashboardEntityCountsDto> GetTechnicianCountsAsync(
        CancellationToken cancellationToken = default);

    Task<DashboardIncidentCountsDto> GetIncidentCountsAsync(
        CancellationToken cancellationToken = default);

    Task<DashboardWorkOrderCountsDto> GetWorkOrderCountsAsync(
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken = default);
}