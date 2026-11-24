using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FieldOps.Infrastructure.Persistence.Configurations;

public sealed class WorkOrderConfiguration
    : IEntityTypeConfiguration<WorkOrder>
{
    public void Configure(EntityTypeBuilder<WorkOrder> builder)
    {
        builder.ToTable("WorkOrders");

        builder.HasKey(x => x.Id);

        // Identificadores y referencias.
        builder.Property(x => x.FacilityId)
            .IsRequired();

        builder.Property(x => x.AssetId)
            .IsRequired(false);

        builder.Property(x => x.IncidentId)
            .IsRequired(false);

        builder.Property(x => x.TechnicianId)
            .IsRequired(false);

        // Datos principales.
        builder.Property(x => x.Code)
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(x => x.Title)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(2000);

        builder.Property(x => x.Priority)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.Status)
            .HasConversion<int>()
            .IsRequired();

        // Fechas de planificacion.
        builder.Property(x => x.ScheduledStartUtc);

        builder.Property(x => x.DueAtUtc);

        // Auditoria temporal.
        builder.Property(x => x.CreatedAtUtc)
            .IsRequired();

        builder.Property(x => x.UpdatedAtUtc)
            .IsRequired();

        builder.Property(x => x.StartedAtUtc);

        builder.Property(x => x.CompletedAtUtc);

        builder.Property(x => x.CancelledAtUtc);

        // Cancelacion.
        builder.Property(x => x.CancellationReason)
            .HasMaxLength(500);

        // Token de concurrencia SQL Server.
        // Es una propiedad shadow administrada por EF Core.
        builder.Property<byte[]>("RowVersion")
            .IsRequired()
            .IsRowVersion();

        // Relaciones: impedir borrados en cascada.
        builder.HasOne<Facility>()
            .WithMany()
            .HasForeignKey(x => x.FacilityId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();

        builder.HasOne<Asset>()
            .WithMany()
            .HasForeignKey(x => x.AssetId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Incident>()
            .WithMany()
            .HasForeignKey(x => x.IncidentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Technician>()
            .WithMany()
            .HasForeignKey(x => x.TechnicianId)
            .OnDelete(DeleteBehavior.Restrict);

        // Integridad y consultas.
        builder.HasIndex(x => x.Code)
            .IsUnique();

        builder.HasIndex(x => new
        {
            x.FacilityId,
            x.Status
        });

        builder.HasIndex(x => x.AssetId);
        builder.HasIndex(x => x.IncidentId);
        builder.HasIndex(x => x.TechnicianId);

        builder.HasIndex(x => x.CreatedAtUtc);
        builder.HasIndex(x => x.DueAtUtc);
    }
}
