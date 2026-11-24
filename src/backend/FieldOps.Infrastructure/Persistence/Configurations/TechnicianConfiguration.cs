using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FieldOps.Infrastructure.Persistence.Configurations;

public sealed class TechnicianConfiguration
    : IEntityTypeConfiguration<Technician>
{
    public void Configure(EntityTypeBuilder<Technician> builder)
    {
        builder.ToTable("Technicians");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Code)
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(t => t.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(t => t.Email)
            .HasMaxLength(254)
            .IsRequired();

        builder.Property(t => t.Phone)
            .HasMaxLength(30);

        builder.Property(t => t.Specialty)
            .HasMaxLength(100);

        builder.Property(t => t.IsActive)
            .IsRequired();

        builder.HasIndex(t => t.Code)
            .IsUnique();
    }
}
