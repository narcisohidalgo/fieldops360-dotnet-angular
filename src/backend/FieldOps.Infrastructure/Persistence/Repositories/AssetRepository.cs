using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Application.Assets;
using Microsoft.Data.SqlClient;
using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence.Repositories;

public sealed class AssetRepository : IAssetRepository
{
    private readonly FieldOpsDbContext _context;

    public AssetRepository(FieldOpsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Asset>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .AsNoTracking()
            .OrderBy(a => a.FacilityId)
            .ThenBy(a => a.Code)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Asset>> GetByFacilityIdAsync(
        Guid facilityId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .AsNoTracking()
            .Where(a => a.FacilityId == facilityId)
            .OrderBy(a => a.Code)
            .ToListAsync(cancellationToken);
    }

    public async Task<Asset?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .FirstOrDefaultAsync(
                a => a.Id == id,
                cancellationToken);
    }

    public async Task<bool> ExistsByCodeAsync(
        Guid facilityId,
        string code,
        CancellationToken cancellationToken = default)
    {
        return await _context.Assets
            .AnyAsync(
                a => a.FacilityId == facilityId &&
                     a.Code == code,
                cancellationToken);
    }

    public async Task AddAsync(
        Asset asset,
        CancellationToken cancellationToken = default)
    {
        await _context.Assets.AddAsync(
            asset,
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
                "IX_Assets_FacilityId_Code",
                StringComparison.OrdinalIgnoreCase))
        {
            var asset = ex.Entries
                .Select(entry => entry.Entity)
                .OfType<Asset>()
                .FirstOrDefault();

            if (asset is null)
            {
                throw;
            }

            throw new DuplicateAssetCodeException(
                asset.FacilityId,
                asset.Code,
                ex);
        }
    }
}
