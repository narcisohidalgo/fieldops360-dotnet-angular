using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Controllers;
using FieldOps.Api.Security;
using FieldOps.Application.Facilities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class AuthenticationIntegrationTests
{
    [SqlServerFact]
    public async Task ValidLogin_CreatesSecureSession_AndLogoutEndsIt()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.RefreshCsrfAsync(client);

        using var login = await client.PostAsJsonAsync(
            "/api/auth/login",
            new
            {
                email = user.Email,
                password = user.Password
            });

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var authenticated = await login.Content
            .ReadFromJsonAsync<AuthUserResponse>();

        Assert.NotNull(authenticated);
        Assert.NotEqual(Guid.Empty, authenticated.Id);
        Assert.Equal(user.Email, authenticated.Email);

        Assert.Equal(
            FieldOpsRoles.Administrator,
            Assert.Single(authenticated.Roles));

        Assert.True(login.Headers.TryGetValues(
            "Set-Cookie", out var cookies));

        var authCookie = Assert.Single(cookies!, cookie =>
            cookie.StartsWith(
                "FieldOps.Auth=", StringComparison.Ordinal));

        Assert.Contains("; httponly", authCookie,
            StringComparison.OrdinalIgnoreCase);

        Assert.Contains("; secure", authCookie,
            StringComparison.OrdinalIgnoreCase);

        Assert.Contains("samesite=lax", authCookie,
            StringComparison.OrdinalIgnoreCase);

        var current = await client
            .GetFromJsonAsync<AuthUserResponse>("/api/auth/me");

        Assert.NotNull(current);
        Assert.Equal(authenticated.Id, current.Id);
        Assert.Equal(authenticated.Email, current.Email);
        Assert.Equal(
            FieldOpsRoles.Administrator,
            Assert.Single(current.Roles));

        await SqlServerApiFactory.RefreshCsrfAsync(client);

        using var logout = await client.PostAsync(
            "/api/auth/logout", null);

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        using var afterLogout = await client.GetAsync(
            "/api/auth/me");

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            afterLogout.StatusCode);
    }

    [SqlServerFact]
    public async Task InvalidCredentials_DoNotRevealAccountExistence()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.RefreshCsrfAsync(client);

        var emails = new[]
        {
            user.Email,
            $"{Guid.NewGuid():N}@example.invalid"
        };

        var incorrectPassword = $"Aa1!{Guid.NewGuid():N}";

        foreach (var email in emails)
        {
            using var response = await client.PostAsJsonAsync(
                "/api/auth/login",
                new
                {
                    email,
                    password = incorrectPassword
                });

            Assert.Equal(
                HttpStatusCode.Unauthorized,
                response.StatusCode);

            var problem = await response.Content
                .ReadFromJsonAsync<ProblemDetails>();

            Assert.NotNull(problem);
            Assert.Equal(401, problem.Status);
            Assert.Equal("Invalid credentials.", problem.Title);

            if (response.Headers.TryGetValues(
                "Set-Cookie", out var cookies))
            {
                Assert.DoesNotContain(cookies, cookie =>
                    cookie.StartsWith(
                        "FieldOps.Auth=",
                        StringComparison.Ordinal));
            }
        }

        using var current = await client.GetAsync(
            "/api/auth/me");

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            current.StatusCode);
    }

    [SqlServerFact]
    public async Task MissingOrInvalidCsrf_RejectsWriteOperations()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        // Login sin cookie ni token CSRF.
        using var rejectedLogin = await client.PostAsJsonAsync(
            "/api/auth/login",
            new
            {
                email = user.Email,
                password = user.Password
            });

        Assert.Equal(
            HttpStatusCode.BadRequest,
            rejectedLogin.StatusCode);

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var command = new CreateFacilityCommand(
            "FAC-CSRF-001",
            "CSRF Test Facility",
            "Cordoba",
            null);

        // Sesion autenticada, pero sin cabecera CSRF.
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        using var missingToken = await client.PostAsJsonAsync(
            "/api/facilities", command);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            missingToken.StatusCode);

        // Sesion autenticada con token manipulado.
        client.DefaultRequestHeaders.Add(
            "X-XSRF-TOKEN", "invalid-token");

        using var invalidToken = await client.PostAsJsonAsync(
            "/api/facilities", command);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            invalidToken.StatusCode);

        await using (var db = database.CreateContext())
        {
            Assert.False(await db.Facilities.AnyAsync());
        }

        // La misma operacion debe funcionar con un token valido.
        await SqlServerApiFactory.RefreshCsrfAsync(client);

        using var validToken = await client.PostAsJsonAsync(
            "/api/facilities", command);

        Assert.Equal(
            HttpStatusCode.Created,
            validToken.StatusCode);

        await using var verification = database.CreateContext();

        Assert.Equal(
            1, await verification.Facilities.CountAsync());
    }
}
