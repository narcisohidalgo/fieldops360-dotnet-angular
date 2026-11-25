using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Security;
using FieldOps.Application.Facilities;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class FacilitiesApiIntegrationTests
{
    private const string Route = "/api/facilities";

    [SqlServerFact]
    public async Task Administrator_CanManageFacilityLifecycle()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var command = new CreateFacilityCommand(
            "FAC-API-001", "Test Facility", "Cordoba",
            "Test address", 37.888175m, -4.779383m);

        using var created = await client.PostAsJsonAsync(
            Route, command);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var facility = await created.Content
            .ReadFromJsonAsync<FacilityDto>();

        Assert.NotNull(facility);
        Assert.NotEqual(Guid.Empty, facility.Id);
        Assert.True(facility.IsActive);

        var url = $"{Route}/{facility.Id}";

        Assert.NotNull(created.Headers.Location);

        using var read = await client.GetAsync(
            created.Headers.Location);

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);

        var stored = await read.Content
            .ReadFromJsonAsync<FacilityDto>();

        Assert.Equal(facility, stored);

        var update = new UpdateFacilityCommand(
            "Updated Facility", "Sevilla", "Updated address",
            37.389092m, -5.984459m);

        using var updated = await client.PutAsJsonAsync(
            url, update);

        Assert.Equal(
            HttpStatusCode.NoContent, updated.StatusCode);

        using var deactivated = await client.PatchAsync(
            $"{url}/deactivate", null);

        Assert.Equal(
            HttpStatusCode.NoContent, deactivated.StatusCode);

        var inactive = await client.GetFromJsonAsync<FacilityDto>(
            url);

        Assert.NotNull(inactive);
        Assert.False(inactive.IsActive);
        Assert.Equal("Updated Facility", inactive.Name);

        using var activated = await client.PatchAsync(
            $"{url}/activate", null);

        Assert.Equal(
            HttpStatusCode.NoContent, activated.StatusCode);

        var facilities = await client
            .GetFromJsonAsync<FacilityDto[]>(Route);

        Assert.NotNull(facilities);

        var final = Assert.Single(facilities);

        Assert.Equal(facility.Id, final.Id);
        Assert.True(final.IsActive);
        Assert.Equal("Updated Facility", final.Name);
        Assert.Equal("Sevilla", final.City);

        // Confirmar persistencia desde un contexto independiente.
        await using var db = database.CreateContext();

        var persisted = await db.Facilities.SingleAsync(
            item => item.Id == facility.Id);

        Assert.True(persisted.IsActive);
        Assert.Equal("Updated Facility", persisted.Name);
        Assert.Equal("Updated address", persisted.Address);
        Assert.Equal(37.389092m, persisted.Latitude);
        Assert.Equal(-5.984459m, persisted.Longitude);
    }

    [SqlServerFact]
    public async Task InvalidDuplicateAndUnknownFacility_ReturnExpectedErrors()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var valid = new CreateFacilityCommand(
            "FAC-API-001", "Test Facility", "Cordoba", null);

        using var created = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        using var duplicate = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(
            HttpStatusCode.Conflict, duplicate.StatusCode);

        using var invalid = await client.PostAsJsonAsync(
            Route, valid with
            {
                Code = "FAC-API-002",
                Latitude = 91m,
                Longitude = 0m
            });

        Assert.Equal(
            HttpStatusCode.BadRequest, invalid.StatusCode);

        using var missing = await client.GetAsync(
            $"{Route}/{Guid.NewGuid()}");

        Assert.Equal(
            HttpStatusCode.NotFound, missing.StatusCode);

        await using var db = database.CreateContext();

        Assert.Equal(1, await db.Facilities.CountAsync());
    }
}
