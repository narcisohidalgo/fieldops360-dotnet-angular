using System.Net;
using FieldOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Integration.Tests;

public sealed class ApiSmokeTests
    : IClassFixture<FieldOpsApiFactory>
{
    private readonly FieldOpsApiFactory _factory;

    public ApiSmokeTests(FieldOpsApiFactory factory)
    {
        _factory = factory;
    }

    private HttpClient CreateClient()
    {
        using var scope = _factory.Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<FieldOpsDbContext>();

        // Impedir el uso accidental de la base de datos real.
        var expected = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(
            FieldOpsApiFactory.TestConnectionString);

        var actual = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(
            db.Database.GetConnectionString());

        Assert.Equal(expected.DataSource, actual.DataSource);
        Assert.Equal(expected.InitialCatalog, actual.InitialCatalog);
        Assert.True(actual.IntegratedSecurity);
        Assert.True(string.IsNullOrEmpty(actual.FailoverPartner));
        Assert.True(string.IsNullOrEmpty(actual.AttachDBFilename));

        return _factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                BaseAddress = new Uri("https://localhost")
            });
    }

    [Theory]
    [InlineData("/api/auth/me")]
    [InlineData("/api/facilities")]
    public async Task ProtectedEndpoint_Anonymous_ReturnsUnauthorized(
        string endpoint)
    {
        using var client = CreateClient();
        using var response = await client.GetAsync(endpoint);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            response.StatusCode);
    }

    [Fact]
    public async Task Csrf_Anonymous_ReturnsOkAndAntiforgeryCookie()
    {
        using var client = CreateClient();

        using var response =
            await client.GetAsync("/api/auth/csrf");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        Assert.Equal(
            "application/json",
            response.Content.Headers.ContentType?.MediaType);

        Assert.True(response.Headers.TryGetValues(
            "Set-Cookie", out var cookies));

        Assert.Contains(cookies!, cookie =>
            cookie.StartsWith(
                "FieldOps.Antiforgery=",
                StringComparison.Ordinal));
    }
}
