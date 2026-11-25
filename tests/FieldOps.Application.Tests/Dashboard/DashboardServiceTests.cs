using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Dashboard;

namespace FieldOps.Application.Tests.Dashboard;

public sealed class DashboardServiceTests
{
    [Fact]
    public async Task GetSummary_ReturnsAllCountsAndTimestamp()
    {
        var now = new DateTimeOffset(
            2026, 11, 25, 10, 0, 0, TimeSpan.Zero);

        var repository = new FakeDashboardRepository();
        var service = new DashboardService(
            repository, new FixedClock(now));

        using var cts = new CancellationTokenSource();

        var result = await service.GetSummaryAsync(cts.Token);

        Assert.Equal(new(8, 5), result.Facilities);
        Assert.Equal(new(20, 18), result.Assets);
        Assert.Equal(new(6, 4), result.Technicians);
        Assert.Equal(new(15, 4, 3, 2, 6), result.Incidents);
        Assert.Equal(
            new(10, 4, 3, 2, 1, 2, 1),
            result.WorkOrders);

        Assert.Equal(now, result.GeneratedAtUtc);
        Assert.Equal(now, repository.RequestedAtUtc);
        Assert.Equal(cts.Token, repository.LastToken);
        Assert.Equal(5, repository.CallCount);
    }

    [Fact]
    public async Task GetSummary_CancelledRequest_DoesNotQuery()
    {
        var repository = new FakeDashboardRepository();
        var service = new DashboardService(
            repository, TimeProvider.System);

        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => service.GetSummaryAsync(cts.Token));

        Assert.Equal(0, repository.CallCount);
    }

    private sealed class FixedClock(
        DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class FakeDashboardRepository
        : IDashboardReadRepository
    {
        public int CallCount { get; private set; }
        public DateTimeOffset? RequestedAtUtc { get; private set; }
        public CancellationToken LastToken { get; private set; }

        private Task<T> Reply<T>(T value, CancellationToken token)
        {
            CallCount++;
            LastToken = token;
            return Task.FromResult(value);
        }

        public Task<DashboardEntityCountsDto> GetFacilityCountsAsync(
            CancellationToken token = default) =>
            Reply(new DashboardEntityCountsDto(8, 5), token);

        public Task<DashboardEntityCountsDto> GetAssetCountsAsync(
            CancellationToken token = default) =>
            Reply(new DashboardEntityCountsDto(20, 18), token);

        public Task<DashboardEntityCountsDto> GetTechnicianCountsAsync(
            CancellationToken token = default) =>
            Reply(new DashboardEntityCountsDto(6, 4), token);

        public Task<DashboardIncidentCountsDto> GetIncidentCountsAsync(
            CancellationToken token = default) =>
            Reply(new DashboardIncidentCountsDto(
                15, 4, 3, 2, 6), token);

        public Task<DashboardWorkOrderCountsDto> GetWorkOrderCountsAsync(
            DateTimeOffset nowUtc,
            CancellationToken token = default)
        {
            RequestedAtUtc = nowUtc;
            return Reply(new DashboardWorkOrderCountsDto(
                10, 4, 3, 2, 1, 2, 1), token);
        }
    }
}