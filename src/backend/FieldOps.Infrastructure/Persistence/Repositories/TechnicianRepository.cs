using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Technicians;
using Microsoft.Data.SqlClient;
using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence.Repositories;

public sealed class TechnicianRepository : ITechnicianRepository
{
    private readonly FieldOpsDbContext _context;

    public TechnicianRepository(FieldOpsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Technician>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Technicians
            .AsNoTracking()
            .OrderBy(t => t.Code)
            .ToListAsync(cancellationToken);
    }

    public async Task<Technician?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.Technicians
            .FirstOrDefaultAsync(
                t => t.Id == id,
                cancellationToken);
    }

    public async Task<bool> ExistsByCodeAsync(
        string code,
        CancellationToken cancellationToken = default)
    {
        return await _context.Technicians
            .AnyAsync(
                t => t.Code == code,
                cancellationToken);
    }

    public async Task AddAsync(
        Technician technician,
        CancellationToken cancellationToken = default)
    {
        await _context.Technicians.AddAsync(
            technician,
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
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException sqlException &&
            (sqlException.Number == 2601 ||
             sqlException.Number == 2627) &&
            sqlException.Message.Contains(
                "IX_Technicians_Code",
                StringComparison.OrdinalIgnoreCase))
        {
            var entity = ex.Entries
                .Select(entry => entry.Entity)
                .OfType<Technician>()
                .FirstOrDefault();

            if (entity is null)
            {
                throw;
            }

            throw new DuplicateTechnicianCodeException(entity.Code, ex);
        }
    }
}
