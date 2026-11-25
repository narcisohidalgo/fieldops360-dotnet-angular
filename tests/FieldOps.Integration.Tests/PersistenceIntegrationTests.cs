using FieldOps.Domain.Entities;
using FieldOps.Infrastructure.Persistence.Repositories;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class PersistenceIntegrationTests
{
    [SqlServerFact]
    public async Task FacilityRepository_PersistsAndUpdatesFacility()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        facility.SetCoordinates(37.888175m, -4.779383m);

        await using (var db = database.CreateContext())
        {
            await db.Database.MigrateAsync();

            var repository = new FacilityRepository(db);

            await repository.AddAsync(facility);
            await repository.SaveChangesAsync();
        }

        await using (var db = database.CreateContext())
        {
            var repository = new FacilityRepository(db);

            var stored = await repository.GetByIdAsync(facility.Id);

            Assert.NotNull(stored);
            Assert.Equal("FAC-001", stored.Code);
            Assert.Equal("Test Facility", stored.Name);
            Assert.Equal(37.888175m, stored.Latitude);
            Assert.Equal(-4.779383m, stored.Longitude);
            Assert.True(stored.IsActive);

            Assert.True(
                await repository.ExistsByCodeAsync("FAC-001"));

            stored.UpdateDetails(
                "Updated Facility", "Sevilla", "Test address");

            stored.Deactivate();

            await repository.SaveChangesAsync();
        }

        await using (var db = database.CreateContext())
        {
            var repository = new FacilityRepository(db);

            var stored = await repository.GetByIdAsync(facility.Id);

            Assert.NotNull(stored);
            Assert.Equal("Updated Facility", stored.Name);
            Assert.Equal("Sevilla", stored.City);
            Assert.Equal("Test address", stored.Address);
            Assert.Equal(37.888175m, stored.Latitude);
            Assert.Equal(-4.779383m, stored.Longitude);
            Assert.False(stored.IsActive);
        }
    }

    [SqlServerFact]
    public async Task Facility_DuplicateCode_IsRejected()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        await db.Database.MigrateAsync();

        db.Facilities.Add(
            new Facility("FAC-001", "Facility A", "Cordoba"));

        await db.SaveChangesAsync();

        db.Facilities.Add(
            new Facility("FAC-001", "Facility B", "Sevilla"));

        var exception = await Assert.ThrowsAsync<DbUpdateException>(
            async () => await db.SaveChangesAsync());

        var sqlException =
            Assert.IsType<SqlException>(exception.InnerException);

        Assert.Contains(sqlException.Number, new[] { 2601, 2627 });
    }

    [SqlServerFact]
    public async Task Asset_DuplicateCodeWithinFacility_IsRejected()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        await db.Database.MigrateAsync();

        var first = new Facility(
            "FAC-001", "Facility A", "Cordoba");

        var second = new Facility(
            "FAC-002", "Facility B", "Sevilla");

        db.Facilities.AddRange(first, second);

        await db.SaveChangesAsync();

        // El mismo codigo es valido en instalaciones diferentes.
        db.Assets.AddRange(
            new Asset(first.Id, "AST-001", "Asset A"),
            new Asset(second.Id, "AST-001", "Asset B"));

        await db.SaveChangesAsync();

        // No se permite repetirlo dentro de una instalacion.
        db.Assets.Add(
            new Asset(first.Id, "AST-001", "Duplicate asset"));

        var exception = await Assert.ThrowsAsync<DbUpdateException>(
            async () => await db.SaveChangesAsync());

        var sqlException =
            Assert.IsType<SqlException>(exception.InnerException);

        Assert.Contains(sqlException.Number, new[] { 2601, 2627 });
    }

    [SqlServerFact]
    public async Task Asset_UnknownFacility_IsRejected()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        await db.Database.MigrateAsync();

        db.Assets.Add(
            new Asset(Guid.NewGuid(), "AST-001", "Orphan asset"));

        var exception = await Assert.ThrowsAsync<DbUpdateException>(
            async () => await db.SaveChangesAsync());

        var sqlException =
            Assert.IsType<SqlException>(exception.InnerException);

        Assert.Equal(547, sqlException.Number);
    }

    [SqlServerFact]
    public async Task Facility_WithAssets_CannotBeDeleted()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        await using (var db = database.CreateContext())
        {
            await db.Database.MigrateAsync();

            db.Facilities.Add(facility);
            await db.SaveChangesAsync();

            db.Assets.Add(
                new Asset(facility.Id, "AST-001", "Test asset"));

            await db.SaveChangesAsync();
        }

        await using (var db = database.CreateContext())
        {
            var stored = await db.Facilities.SingleAsync(
                item => item.Id == facility.Id);

            db.Facilities.Remove(stored);

            var exception =
                await Assert.ThrowsAsync<DbUpdateException>(
                    async () => await db.SaveChangesAsync());

            var sqlException =
                Assert.IsType<SqlException>(exception.InnerException);

            Assert.Equal(547, sqlException.Number);
        }

        await using (var db = database.CreateContext())
        {
            Assert.True(await db.Facilities.AnyAsync(
                item => item.Id == facility.Id));

            Assert.True(await db.Assets.AnyAsync(
                item => item.FacilityId == facility.Id));
        }
    }
}
