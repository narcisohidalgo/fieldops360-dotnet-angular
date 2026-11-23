using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Incidents;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence.Repositories;

public sealed class IncidentRepository : IIncidentRepository
{
    private readonly FieldOpsDbContext _context;

    public IncidentRepository(FieldOpsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Incident>> GetAllAsync(
        Guid? facilityId = null,
        Guid? assetId = null,
        IncidentStatus? status = null,
        IncidentPriority? priority = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Incident> query = _context.Incidents
            .AsNoTracking();

        if (facilityId.HasValue)
        {
            query = query.Where(
                i => i.FacilityId == facilityId.Value);
        }

        if (assetId.HasValue)
        {
            query = query.Where(
                i => i.AssetId == assetId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(
                i => i.Status == status.Value);
        }

        if (priority.HasValue)
        {
            query = query.Where(
                i => i.Priority == priority.Value);
        }

        return await query
            .OrderByDescending(i => i.CreatedAtUtc)
            .ThenBy(i => i.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<Incident?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.Incidents
            .FirstOrDefaultAsync(
                i => i.Id == id,
                cancellationToken);
    }

    public async Task AddAsync(
        Incident incident,
        CancellationToken cancellationToken = default)
    {
        await _context.Incidents.AddAsync(
            incident,
            cancellationToken);
    }

    public async Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new IncidentConcurrencyException(
                "The incident was modified by another request. Refresh and try again.",
                ex);
        }
    }
}
