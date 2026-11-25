using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Controllers;
using FieldOps.Infrastructure.Identity;
using FieldOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace FieldOps.Integration.Tests;

public sealed class SqlServerApiFactory(
    SqlServerTestDatabase database)
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(
        IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.ConfigureHostConfiguration(configuration =>
        {
            configuration.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ConnectionStrings:FieldOpsDb"] =
                        database.ConnectionString,
                    ["environment"] = "Testing"
                });
        });

        return base.CreateHost(builder);
    }

    public async Task InitializeDatabaseAsync()
    {
        await using var scope = Services.CreateAsyncScope();

        var db = scope.ServiceProvider
            .GetRequiredService<FieldOpsDbContext>();

        // Verify the isolated connection before applying migrations.
        database.AssertIsolatedConnection(
            db.Database.GetConnectionString());

        await db.Database.MigrateAsync();
    }

    public HttpClient CreateSessionClient()
    {
        return CreateClient(
            new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true,
                BaseAddress = new Uri("https://localhost")
            });
    }

    public async Task<(string Email, string Password)> CreateUserAsync(
        string role,
        Guid? technicianId = null)
    {
        await using var scope = Services.CreateAsyncScope();

        var roles = scope.ServiceProvider
            .GetRequiredService<RoleManager<IdentityRole<Guid>>>();

        var users = scope.ServiceProvider
            .GetRequiredService<UserManager<FieldOpsUser>>();

        if (!await roles.RoleExistsAsync(role))
        {
            EnsureSuccess(await roles.CreateAsync(
                new IdentityRole<Guid>(role)));
        }

        var email = $"{Guid.NewGuid():N}@example.invalid";
        var password = $"Aa1!{Guid.NewGuid():N}";

        var user = new FieldOpsUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            UserName = email,
            DisplayName = "Integration Test User",
            IsActive = true,
            TechnicianId = technicianId
        };

        EnsureSuccess(await users.CreateAsync(user, password));
        EnsureSuccess(await users.AddToRoleAsync(user, role));

        return (email, password);
    }

    public static async Task RefreshCsrfAsync(HttpClient client)
    {
        using var response =
            await client.GetAsync("/api/auth/csrf");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var csrf = await response.Content
            .ReadFromJsonAsync<CsrfTokenResponse>();

        Assert.NotNull(csrf);
        Assert.False(string.IsNullOrWhiteSpace(csrf.RequestToken));

        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        client.DefaultRequestHeaders.Add(
            "X-XSRF-TOKEN", csrf.RequestToken);
    }

    public static async Task LoginAsync(
        HttpClient client,
        string email,
        string password)
    {
        await RefreshCsrfAsync(client);

        using var response = await client.PostAsJsonAsync(
            "/api/auth/login", new { email, password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // El token debe renovarse tras autenticar al usuario.
        await RefreshCsrfAsync(client);
    }

    private static void EnsureSuccess(IdentityResult result)
    {
        Assert.True(result.Succeeded,
            string.Join("; ",
                result.Errors.Select(error => error.Description)));
    }
}
