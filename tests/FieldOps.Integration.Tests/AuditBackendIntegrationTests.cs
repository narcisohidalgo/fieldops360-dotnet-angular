using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Controllers;
using FieldOps.Api.Security;
using FieldOps.Application.Facilities;
using FieldOps.Application.Technicians;
using FieldOps.Domain.Entities;
using FieldOps.Infrastructure.Persistence.Repositories;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class AuditBackendIntegrationTests
{
    [SqlServerFact]
    public async Task Facility_DuplicateCodeAfterPrecheck_ThrowsBusinessException()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using (var setup = database.CreateContext())
        {
            await setup.Database.MigrateAsync();
        }

        await using var firstDb = database.CreateContext();
        await using var secondDb = database.CreateContext();

        var first = new FacilityRepository(firstDb);
        var second = new FacilityRepository(secondDb);

        const string code = "AUD-FAC-001";

        // Both requests pass the initial existence check.
        Assert.False(await first.ExistsByCodeAsync(code));
        Assert.False(await second.ExistsByCodeAsync(code));

        await first.AddAsync(
            new Facility(code, "Original facility", "Cordoba"));

        await second.AddAsync(
            new Facility(code, "Duplicate facility", "Madrid"));

        await first.SaveChangesAsync();

        var exception =
            await Assert.ThrowsAsync<DuplicateFacilityCodeException>(
                async () => await second.SaveChangesAsync());

        var updateException =
            Assert.IsType<DbUpdateException>(
                exception.InnerException);

        var sql = Assert.IsType<SqlException>(
            updateException.InnerException);

        Assert.Contains(sql.Number, new[] { 2601, 2627 });

        await using var verification = database.CreateContext();

        var stored = await verification.Facilities.SingleAsync(
            item => item.Code == code);

        Assert.Equal("Original facility", stored.Name);
        Assert.Equal("Cordoba", stored.City);
    }

    [SqlServerFact]
    public async Task Technician_DuplicateCodeAfterPrecheck_ThrowsBusinessException()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using (var setup = database.CreateContext())
        {
            await setup.Database.MigrateAsync();
        }

        await using var firstDb = database.CreateContext();
        await using var secondDb = database.CreateContext();

        var first = new TechnicianRepository(firstDb);
        var second = new TechnicianRepository(secondDb);

        const string code = "AUD-TEC-001";

        Assert.False(await first.ExistsByCodeAsync(code));
        Assert.False(await second.ExistsByCodeAsync(code));

        await first.AddAsync(new Technician(
            code,
            "Original technician",
            "first@example.invalid"));

        await second.AddAsync(new Technician(
            code,
            "Duplicate technician",
            "second@example.invalid"));

        await first.SaveChangesAsync();

        var exception =
            await Assert.ThrowsAsync<DuplicateTechnicianCodeException>(
                async () => await second.SaveChangesAsync());

        var updateException =
            Assert.IsType<DbUpdateException>(
                exception.InnerException);

        var sql = Assert.IsType<SqlException>(
            updateException.InnerException);

        Assert.Contains(sql.Number, new[] { 2601, 2627 });

        await using var verification = database.CreateContext();

        var stored = await verification.Technicians.SingleAsync(
            item => item.Code == code);

        Assert.Equal("Original technician", stored.Name);
        Assert.Equal("first@example.invalid", stored.Email);
    }

    [SqlServerFact]
    public async Task ConcurrentAdministratorDeactivation_PreservesOneActiveAdministrator()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var firstAdmin = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        var secondAdmin = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var firstClient = factory.CreateSessionClient();
        using var secondClient = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            firstClient, firstAdmin.Email, firstAdmin.Password);

        await SqlServerApiFactory.LoginAsync(
            secondClient, secondAdmin.Email, secondAdmin.Password);

        var firstUser = await firstClient
            .GetFromJsonAsync<AuthUserResponse>("/api/auth/me");

        var secondUser = await secondClient
            .GetFromJsonAsync<AuthUserResponse>("/api/auth/me");

        Assert.NotNull(firstUser);
        Assert.NotNull(secondUser);

        var firstRequest = firstClient.PatchAsync(
            $"/api/users/{firstUser.Id}/deactivate", null);

        var secondRequest = secondClient.PatchAsync(
            $"/api/users/{secondUser.Id}/deactivate", null);

        await Task.WhenAll(firstRequest, secondRequest);

        using var firstResponse = await firstRequest;
        using var secondResponse = await secondRequest;

        var statuses = new[]
        {
            firstResponse.StatusCode,
            secondResponse.StatusCode
        };

        Assert.Single(statuses,
            status => status == HttpStatusCode.OK);

        Assert.Single(statuses,
            status => status == HttpStatusCode.Conflict);

        await using var verification = database.CreateContext();

        var activeAdministrators = await (
            from user in verification.Users
            join assignment in verification.UserRoles
                on user.Id equals assignment.UserId
            join role in verification.Roles
                on assignment.RoleId equals role.Id
            where user.IsActive &&
                  role.NormalizedName == "ADMINISTRATOR"
            select user.Id
        ).Distinct().CountAsync();

        Assert.Equal(1, activeAdministrators);
    }

    [SqlServerFact]
    public async Task OversizedPasswords_AreRejectedWithoutChangingAccounts()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var admin = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        var supervisor = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        using var adminClient = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            adminClient, admin.Email, admin.Password);

        using var supervisorClient = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            supervisorClient,
            supervisor.Email,
            supervisor.Password);

        var supervisorUser = await supervisorClient
            .GetFromJsonAsync<AuthUserResponse>("/api/auth/me");

        Assert.NotNull(supervisorUser);

        // 1025 characters; valid character composition.
        var oversized = "Aa1!" + new string('x', 1021);

        Assert.Equal(1025, oversized.Length);

        using var anonymousClient = factory.CreateSessionClient();

        await SqlServerApiFactory.RefreshCsrfAsync(anonymousClient);

        using var login = await anonymousClient.PostAsJsonAsync(
            "/api/auth/login",
            new
            {
                email = supervisor.Email,
                password = oversized
            });

        Assert.Equal(HttpStatusCode.BadRequest, login.StatusCode);

        var newEmail = $"{Guid.NewGuid():N}@example.invalid";

        using var creation = await adminClient.PostAsJsonAsync(
            "/api/users",
            new CreateManagedUserRequest
            {
                Email = newEmail,
                DisplayName = "Oversized password account",
                Password = oversized,
                Role = FieldOpsRoles.Supervisor
            });

        Assert.Equal(HttpStatusCode.BadRequest, creation.StatusCode);

        using var reset = await adminClient.PostAsJsonAsync(
            $"/api/users/{supervisorUser.Id}/reset-password",
            new ResetManagedUserPasswordRequest
            {
                NewPassword = oversized
            });

        Assert.Equal(HttpStatusCode.BadRequest, reset.StatusCode);

        // The existing password must still work.
        using var restoredSession = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            restoredSession,
            supervisor.Email,
            supervisor.Password);

        await using var verification = database.CreateContext();

        Assert.False(await verification.Users.AnyAsync(
            user => user.Email == newEmail));

        Assert.Equal(2, await verification.Users.CountAsync());
    }
}
