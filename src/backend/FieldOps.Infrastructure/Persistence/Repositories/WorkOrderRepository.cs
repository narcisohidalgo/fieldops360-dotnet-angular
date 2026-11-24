using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.WorkOrders;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence.Repositories;

public sealed class WorkOrderRepository : IWorkOrderRepository
{
    private readonly FieldOpsDbContext _context;

    public WorkOrderRepository(FieldOpsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<WorkOrder>> GetAllAsync(
        Guid? facilityId = null,
        Guid? assetId = null,
        Guid? incidentId = null,
        Guid? technicianId = null,
        WorkOrderStatus? status = null,
        WorkOrderPriority? priority = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<WorkOrder> query = _context.WorkOrders
            .AsNoTracking();

        if (facilityId.HasValue)
        {
            query = query.Where(x =>
                x.FacilityId == facilityId.Value);
        }

        if (assetId.HasValue)
        {
            query = query.Where(x =>
                x.AssetId == assetId.Value);
        }

        if (incidentId.HasValue)
        {
            query = query.Where(x =>
                x.IncidentId == incidentId.Value);
        }

        if (technicianId.HasValue)
        {
            query = query.Where(x =>
                x.TechnicianId == technicianId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(x =>
                x.Status == status.Value);
        }

        if (priority.HasValue)
        {
            query = query.Where(x =>
                x.Priority == priority.Value);
        }

        return await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<WorkOrder?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        // Consulta con tracking para operaciones de escritura.
        return await _context.WorkOrders
            .FirstOrDefaultAsync(
                x => x.Id == id,
                cancellationToken);
    }

    public async Task<bool> ExistsByCodeAsync(
        string code,
        CancellationToken cancellationToken = default)
    {
        return await _context.WorkOrders
            .AnyAsync(
                x => x.Code == code,
                cancellationToken);
    }

    public async Task AddAsync(
        WorkOrder workOrder,
        CancellationToken cancellationToken = default)
    {
        await _context.WorkOrders.AddAsync(
            workOrder,
            cancellationToken);
    }

    public async Task<int> SaveChangesAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await _context.SaveChangesAsync(
                cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new WorkOrderConcurrencyException(
                "The work order was modified concurrently. " +
                "Refresh and try again.",
                ex);
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException { Number: 2601 or 2627 } sql &&
            sql.Message.Contains(
                "IX_WorkOrders_Code",
                StringComparison.Ordinal) &&
            ex.Entries.Any(entry => entry.Entity is WorkOrder))
        {
            // SQL Server rejected a duplicate WorkOrders.Code.
            // Translate only this specific unique-index violation.
            var order = ex.Entries
                .Select(entry => entry.Entity)
                .OfType<WorkOrder>()
                .First();

            throw new DuplicateWorkOrderCodeException(order.Code);
        }
    }
}
