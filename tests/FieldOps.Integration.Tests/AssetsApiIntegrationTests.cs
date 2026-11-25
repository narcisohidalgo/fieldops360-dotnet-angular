using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Security;
using FieldOps.Application.Assets;
using FieldOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class AssetsApiIntegrationTests
{
    private const string Route = "/api/assets";

    private static async Task<(Guid First, Guid Second)> SeedFacilitiesAsync(
        SqlServerTestDatabase database)
    {
        await using var db = database.CreateContext();

        var first = new Facility(
            "FAC-001", "Facility A", "Cordoba");

        var second = new Facility(
            "FAC-002", "Facility B", "Sevilla");

        db.Facilities.AddRange(first, second);

        await db.SaveChangesAsync();

        return (first.Id, second.Id);
    }

    [SqlServerFact]
    public async Task Supervisor_CanManageAssetLifecycleAndFilterByFacility()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var facilities = await SeedFacilitiesAsync(database);

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var command = new CreateAssetCommand(
            facilities.First,
            "AST-001", "Test Asset", "Initial description");

        using var created = await client.PostAsJsonAsync(
            Route, command);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var asset = await created.Content
            .ReadFromJsonAsync<AssetDto>();

        Assert.NotNull(asset);
        Assert.NotEqual(Guid.Empty, asset.Id);
        Assert.Equal(facilities.First, asset.FacilityId);
        Assert.True(asset.IsActive);

        Assert.NotNull(created.Headers.Location);

        using var read = await client.GetAsync(
            created.Headers.Location);

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);

        Assert.Equal(asset,
            await read.Content.ReadFromJsonAsync<AssetDto>());

        // El mismo codigo se permite en otra instalacion.
        using var second = await client.PostAsJsonAsync(
            Route, command with
            {
                FacilityId = facilities.Second
            });

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);

        var all = await client.GetFromJsonAsync<AssetDto[]>(Route);

        Assert.NotNull(all);
        Assert.Equal(2, all.Length);

        var filtered = await client.GetFromJsonAsync<AssetDto[]>(
            $"{Route}?facilityId={facilities.First}");

        Assert.NotNull(filtered);

        Assert.Equal(asset.Id, Assert.Single(filtered).Id);

        var url = $"{Route}/{asset.Id}";

        using var updated = await client.PutAsJsonAsync(
            url, new UpdateAssetCommand(
                "Updated Asset", "Updated description"));

        Assert.Equal(
            HttpStatusCode.NoContent, updated.StatusCode);

        using var deactivated = await client.PatchAsync(
            $"{url}/deactivate", null);

        Assert.Equal(
            HttpStatusCode.NoContent, deactivated.StatusCode);

        var inactive = await client.GetFromJsonAsync<AssetDto>(url);

        Assert.NotNull(inactive);
        Assert.False(inactive.IsActive);
        Assert.Equal("Updated Asset", inactive.Name);

        using var activated = await client.PatchAsync(
            $"{url}/activate", null);

        Assert.Equal(
            HttpStatusCode.NoContent, activated.StatusCode);

        var active = await client.GetFromJsonAsync<AssetDto>(url);

        Assert.NotNull(active);
        Assert.True(active.IsActive);

        await using var db = database.CreateContext();

        var persisted = await db.Assets.SingleAsync(
            item => item.Id == asset.Id);

        Assert.True(persisted.IsActive);
        Assert.Equal("AST-001", persisted.Code);
        Assert.Equal("Updated Asset", persisted.Name);
        Assert.Equal("Updated description", persisted.Description);
        Assert.Equal(facilities.First, persisted.FacilityId);
    }

    [SqlServerFact]
    public async Task InvalidDuplicateAndUnknownAsset_ReturnExpectedErrors()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var facilities = await SeedFacilitiesAsync(database);

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var valid = new CreateAssetCommand(
            facilities.First, "AST-001", "Test Asset", null);

        using var created = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        using var duplicate = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(
            HttpStatusCode.Conflict, duplicate.StatusCode);

        using var unknownFacility = await client.PostAsJsonAsync(
            Route, valid with
            {
                FacilityId = Guid.NewGuid()
            });

        Assert.Equal(
            HttpStatusCode.NotFound, unknownFacility.StatusCode);

        using var invalid = await client.PostAsJsonAsync(
            Route, valid with
            {
                Code = "AST-002",
                Name = ""
            });

        Assert.Equal(
            HttpStatusCode.BadRequest, invalid.StatusCode);

        using var invalidFilter = await client.GetAsync(
            $"{Route}?facilityId={Guid.Empty}");

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidFilter.StatusCode);

        using var missing = await client.GetAsync(
            $"{Route}/{Guid.NewGuid()}");

        Assert.Equal(
            HttpStatusCode.NotFound, missing.StatusCode);

        await using var db = database.CreateContext();

        Assert.Equal(1, await db.Assets.CountAsync());
    }
}
