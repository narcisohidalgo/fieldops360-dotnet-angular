using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Facilities;
using Microsoft.Data.SqlClient;
using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence.Repositories;

public sealed class FacilityRepository : IFacilityRepository
{
    private readonly FieldOpsDbContext _context;

    public FacilityRepository(FieldOpsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Facility>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Facilities
            .AsNoTracking()
            .OrderBy(f => f.Code)
            .ToListAsync(cancellationToken);
    }

    public async Task<Facility?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.Facilities
            .FirstOrDefaultAsync(
                f => f.Id == id,
                cancellationToken);
    }

    public async Task<bool> ExistsByCodeAsync(
        string code,
        CancellationToken cancellationToken = default)
    {
        return await _context.Facilities
            .AnyAsync(
                f => f.Code == code,
                cancellationToken);
    }

    public async Task AddAsync(
        Facility facility,
        CancellationToken cancellationToken = default)
    {
        await _context.Facilities.AddAsync(
            facility,
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
                "IX_Facilities_Code",
                StringComparison.OrdinalIgnoreCase))
        {
            var entity = ex.Entries
                .Select(entry => entry.Entity)
                .OfType<Facility>()
                .FirstOrDefault();

            if (entity is null)
            {
                throw;
            }

            throw new DuplicateFacilityCodeException(entity.Code, ex);
        }
    }
}
