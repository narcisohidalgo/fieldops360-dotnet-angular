using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FieldOps.Infrastructure.Persistence.Configurations;

public sealed class IncidentConfiguration : IEntityTypeConfiguration<Incident>
{
    public void Configure(EntityTypeBuilder<Incident> builder)
    {
        builder.ToTable("Incidents");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.FacilityId)
            .IsRequired();

        builder.Property(i => i.AssetId)
            .IsRequired(false);

        builder.Property(i => i.Title)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(i => i.Description)
            .HasMaxLength(2000);

        builder.Property(i => i.Priority)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(i => i.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(i => i.CreatedAtUtc)
            .IsRequired();

        builder.Property(i => i.UpdatedAtUtc)
            .IsRequired();

        // SQL Server rowversion for optimistic concurrency.
        builder.Property<byte[]>("RowVersion")
            .IsRequired()
            .IsRowVersion();

        builder.Property(i => i.ResolvedAtUtc);

        builder.Property(i => i.ClosedAtUtc);

        // Cada incidencia pertenece a una instalacion.
        builder.HasOne<Facility>()
            .WithMany()
            .HasForeignKey(i => i.FacilityId)
            .OnDelete(DeleteBehavior.Restrict);

        // La asociacion con un activo es opcional.
        builder.HasOne<Asset>()
            .WithMany()
            .HasForeignKey(i => i.AssetId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indices para consultas y filtros frecuentes.
        builder.HasIndex(i => new { i.FacilityId, i.Status });

        builder.HasIndex(i => i.AssetId);

        builder.HasIndex(i => i.CreatedAtUtc);
    }
}
