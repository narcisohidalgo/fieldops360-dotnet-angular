using FieldOps.Application.Abstractions.Persistence;

namespace FieldOps.Application.Dashboard;

public sealed class DashboardService : IDashboardService
{
    private readonly IDashboardReadRepository _repository;
    private readonly TimeProvider _clock;

    public DashboardService(
        IDashboardReadRepository repository,
        TimeProvider clock)
    {
        _repository = repository;
        _clock = clock;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var nowUtc = _clock.GetUtcNow();

        var facilities = await _repository
            .GetFacilityCountsAsync(cancellationToken);

        var assets = await _repository
            .GetAssetCountsAsync(cancellationToken);

        var technicians = await _repository
            .GetTechnicianCountsAsync(cancellationToken);

        var incidents = await _repository
            .GetIncidentCountsAsync(cancellationToken);

        var orders = await _repository
            .GetWorkOrderCountsAsync(nowUtc, cancellationToken);

        return new DashboardSummaryDto(
            facilities,
            assets,
            technicians,
            incidents,
            orders,
            nowUtc);
    }
}