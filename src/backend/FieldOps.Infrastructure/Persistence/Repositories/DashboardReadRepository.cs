using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Dashboard;
using FieldOps.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence.Repositories;

public sealed class DashboardReadRepository : IDashboardReadRepository
{
    private readonly FieldOpsDbContext _context;

    public DashboardReadRepository(FieldOpsDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardEntityCountsDto> GetFacilityCountsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Facilities
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new DashboardEntityCountsDto(
                group.Count(),
                group.Count(x => x.IsActive)))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new DashboardEntityCountsDto(0, 0);
    }

    public async Task<DashboardEntityCountsDto> GetAssetCountsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new DashboardEntityCountsDto(
                group.Count(),
                group.Count(x => x.IsActive)))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new DashboardEntityCountsDto(0, 0);
    }

    public async Task<DashboardEntityCountsDto> GetTechnicianCountsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Technicians
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new DashboardEntityCountsDto(
                group.Count(),
                group.Count(x => x.IsActive)))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new DashboardEntityCountsDto(0, 0);
    }

    public async Task<DashboardIncidentCountsDto> GetIncidentCountsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Incidents
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new DashboardIncidentCountsDto(
                group.Count(),
                group.Count(x => x.Status == IncidentStatus.Open),
                group.Count(x => x.Status == IncidentStatus.InProgress),
                group.Count(x => x.Status == IncidentStatus.Resolved),
                group.Count(x => x.Status == IncidentStatus.Closed)))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new DashboardIncidentCountsDto(0, 0, 0, 0, 0);
    }

    public async Task<DashboardWorkOrderCountsDto> GetWorkOrderCountsAsync(
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken = default)
    {
        return await _context.WorkOrders
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new DashboardWorkOrderCountsDto(
                group.Count(),
                group.Count(x => x.Status == WorkOrderStatus.Planned),
                group.Count(x => x.Status == WorkOrderStatus.InProgress),
                group.Count(x => x.Status == WorkOrderStatus.Completed),
                group.Count(x => x.Status == WorkOrderStatus.Cancelled),
                group.Count(x =>
                    (x.Status == WorkOrderStatus.Planned ||
                     x.Status == WorkOrderStatus.InProgress) &&
                    x.DueAtUtc.HasValue &&
                    x.DueAtUtc.Value < nowUtc),
                group.Count(x =>
                    x.Status == WorkOrderStatus.Planned &&
                    !x.TechnicianId.HasValue)))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new DashboardWorkOrderCountsDto(
                0, 0, 0, 0, 0, 0, 0);
    }
}