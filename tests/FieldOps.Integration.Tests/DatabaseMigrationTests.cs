using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class DatabaseMigrationTests
{
    [SqlServerFact]
    public async Task Migrations_CreateCompleteDatabaseSchema()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        var expected = db.Database.GetMigrations().ToArray();

        Assert.NotEmpty(expected);

        await db.Database.MigrateAsync();

        Assert.True(await db.Database.CanConnectAsync());

        var applied =
            await db.Database.GetAppliedMigrationsAsync();

        Assert.Equal(expected, applied.ToArray());

        Assert.Empty(
            await db.Database.GetPendingMigrationsAsync());

        // Verificar acceso real a las tablas operativas.
        await db.Facilities.AnyAsync();
        await db.Assets.AnyAsync();
        await db.Incidents.AnyAsync();
        await db.Technicians.AnyAsync();
        await db.WorkOrders.AnyAsync();

        // Verificar acceso a las tablas de Identity.
        await db.Users.AnyAsync();
        await db.Roles.AnyAsync();
    }
}
