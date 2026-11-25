using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FieldOps.Api.Controllers;
using FieldOps.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class UserManagementIntegrationTests
{
    private const string Route = "/api/users";

    [SqlServerFact]
    public async Task Administrator_CanCreateUser_WithoutExposingCredentials()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var admin = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        // Garantizar que existe el rol Supervisor.
        await factory.CreateUserAsync(FieldOpsRoles.Supervisor);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, admin.Email, admin.Password);

        var request = new CreateManagedUserRequest
        {
            Email = $"{Guid.NewGuid():N}@example.invalid",
            DisplayName = "Managed Supervisor",
            Password = $"Aa1!{Guid.NewGuid():N}",
            Role = FieldOpsRoles.Supervisor
        };

        using var created = await client.PostAsJsonAsync(
            Route, request);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var body = await created.Content.ReadAsStringAsync();

        using var json = JsonDocument.Parse(body);

        Assert.DoesNotContain(
            json.RootElement.EnumerateObject(),
            property => property.Name.Contains(
                "password", StringComparison.OrdinalIgnoreCase));

        Assert.DoesNotContain(request.Password, body);

        var user = await created.Content
            .ReadFromJsonAsync<ManagedUserDto>();

        Assert.NotNull(user);
        Assert.NotEqual(Guid.Empty, user.Id);
        Assert.Equal(request.Email, user.Email);
        Assert.Equal(request.DisplayName, user.DisplayName);
        Assert.True(user.IsActive);
        Assert.Null(user.TechnicianId);

        Assert.Equal(
            FieldOpsRoles.Supervisor,
            Assert.Single(user.Roles));

        Assert.NotNull(created.Headers.Location);

        using var read = await client.GetAsync(
            created.Headers.Location);

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);

        using var duplicate = await client.PostAsJsonAsync(
            Route, request);

        Assert.Equal(
            HttpStatusCode.Conflict, duplicate.StatusCode);

        var weakPassword = new CreateManagedUserRequest
        {
            Email = $"{Guid.NewGuid():N}@example.invalid",
            DisplayName = "Invalid Account",
            Password = "weak",
            Role = FieldOpsRoles.Supervisor
        };

        using var rejected = await client.PostAsJsonAsync(
            Route, weakPassword);

        Assert.Equal(
            HttpStatusCode.BadRequest, rejected.StatusCode);

        await using var db = database.CreateContext();

        var stored = await db.Users.SingleAsync(
            item => item.Id == user.Id);

        Assert.False(
            string.IsNullOrWhiteSpace(stored.PasswordHash));

        Assert.NotEqual(request.Password, stored.PasswordHash);

        Assert.Equal(1, await db.Users.CountAsync(
            item => item.Email == request.Email));

        Assert.False(await db.Users.AnyAsync(
            item => item.Email == weakPassword.Email));

        // Confirmar que la cuenta creada puede autenticarse.
        using var userClient = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            userClient, request.Email, request.Password);
    }

    [SqlServerFact]
    public async Task PasswordResetAndDeactivation_InvalidateExistingSessions()
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
        using var userClient = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            adminClient, admin.Email, admin.Password);

        await SqlServerApiFactory.LoginAsync(
            userClient, supervisor.Email, supervisor.Password);

        var current = await userClient
            .GetFromJsonAsync<AuthUserResponse>("/api/auth/me");

        Assert.NotNull(current);

        var url = $"{Route}/{current.Id}";

        var newPassword = $"Aa1!{Guid.NewGuid():N}";

        using var reset = await adminClient.PostAsJsonAsync(
            $"{url}/reset-password",
            new ResetManagedUserPasswordRequest
            {
                NewPassword = newPassword
            });

        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        // La sesion anterior debe quedar invalidada.
        using var expired = await userClient.GetAsync(
            "/api/auth/me");

        Assert.Equal(
            HttpStatusCode.Unauthorized, expired.StatusCode);

        using var newSession = factory.CreateSessionClient();

        await SqlServerApiFactory.RefreshCsrfAsync(newSession);

        // La contrasena anterior deja de ser valida.
        using var oldPassword = await newSession.PostAsJsonAsync(
            "/api/auth/login",
            new
            {
                email = supervisor.Email,
                password = supervisor.Password
            });

        Assert.Equal(
            HttpStatusCode.Unauthorized, oldPassword.StatusCode);

        await SqlServerApiFactory.LoginAsync(
            newSession, supervisor.Email, newPassword);

        // Desactivar la cuenta mientras tiene una sesion abierta.
        using var deactivated = await adminClient.PatchAsync(
            $"{url}/deactivate", null);

        Assert.Equal(HttpStatusCode.OK, deactivated.StatusCode);

        var inactive = await deactivated.Content
            .ReadFromJsonAsync<ManagedUserDto>();

        Assert.NotNull(inactive);
        Assert.False(inactive.IsActive);

        using var denied = await newSession.GetAsync(
            "/api/auth/me");

        Assert.Equal(
            HttpStatusCode.Unauthorized, denied.StatusCode);

        using var inactiveSession = factory.CreateSessionClient();

        await SqlServerApiFactory.RefreshCsrfAsync(inactiveSession);

        using var inactiveLogin =
            await inactiveSession.PostAsJsonAsync(
                "/api/auth/login",
                new
                {
                    email = supervisor.Email,
                    password = newPassword
                });

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            inactiveLogin.StatusCode);

        // Reactivar la cuenta y comprobar un nuevo acceso.
        using var activated = await adminClient.PatchAsync(
            $"{url}/activate", null);

        Assert.Equal(HttpStatusCode.OK, activated.StatusCode);

        var active = await activated.Content
            .ReadFromJsonAsync<ManagedUserDto>();

        Assert.NotNull(active);
        Assert.True(active.IsActive);

        using var restoredSession = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            restoredSession, supervisor.Email, newPassword);

        await using var db = database.CreateContext();

        var stored = await db.Users.SingleAsync(
            item => item.Id == current.Id);

        Assert.True(stored.IsActive);
    }
}
