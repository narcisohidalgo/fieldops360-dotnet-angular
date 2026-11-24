using FieldOps.Domain.Entities;
using FieldOps.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Infrastructure.Persistence;

public sealed class FieldOpsDbContext : IdentityDbContext<FieldOpsUser, IdentityRole<Guid>, Guid>
{
    public FieldOpsDbContext(DbContextOptions<FieldOpsDbContext> options)
        : base(options)
    {
    }

    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<Technician> Technicians => Set<Technician>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(FieldOpsDbContext).Assembly);

        // Identity se mantiene fuera de FieldOps.Domain.
        modelBuilder.Entity<FieldOpsUser>(entity =>
        {
            entity.Property(user => user.DisplayName)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(user => user.IsActive)
                .HasDefaultValue(true)
                .IsRequired();

            // Un tecnico puede vincularse, como maximo,
            // a una cuenta de acceso.
            entity.HasIndex(user => user.TechnicianId)
                .IsUnique();

            entity.HasOne<Technician>()
                .WithMany()
                .HasForeignKey(user => user.TechnicianId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
