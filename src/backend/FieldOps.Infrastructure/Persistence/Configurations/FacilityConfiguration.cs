using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FieldOps.Infrastructure.Persistence.Configurations;

public sealed class FacilityConfiguration : IEntityTypeConfiguration<Facility>
{
    public void Configure(EntityTypeBuilder<Facility> builder)
    {
        builder.ToTable("Facilities");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.Code)
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(f => f.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(f => f.City)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(f => f.Address)
            .HasMaxLength(250);

        builder.Property(f => f.IsActive)
            .IsRequired();

        builder.HasIndex(f => f.Code)
            .IsUnique();

        builder.HasMany(f => f.Assets)
            .WithOne(a => a.Facility)
            .HasForeignKey(a => a.FacilityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
