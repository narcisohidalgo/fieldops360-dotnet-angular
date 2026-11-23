using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence;

public sealed class FieldOpsDbContext : DbContext
{
    public FieldOpsDbContext(DbContextOptions<FieldOpsDbContext> options)
        : base(options)
    {
    }

    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Incident> Incidents => Set<Incident>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(FieldOpsDbContext).Assembly);
    }
}
