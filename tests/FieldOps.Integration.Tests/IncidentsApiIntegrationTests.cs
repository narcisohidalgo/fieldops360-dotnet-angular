using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Security;
using FieldOps.Application.Incidents;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class IncidentsApiIntegrationTests
{
    private const string Route = "/api/incidents";

    private static async Task<(Guid FacilityId, Guid AssetId, Guid OtherFacilityId)>
        SeedAsync(SqlServerTestDatabase database)
    {
        await using var db = database.CreateContext();

        var facility = new Facility(
            "FAC-001", "Facility A", "Cordoba");

        var other = new Facility(
            "FAC-002", "Facility B", "Sevilla");

        var asset = new Asset(
            facility.Id, "AST-001", "Test Asset");

        db.Facilities.AddRange(facility, other);
        db.Assets.Add(asset);

        await db.SaveChangesAsync();

        return (facility.Id, asset.Id, other.Id);
    }

    [SqlServerFact]
    public async Task Supervisor_CanManageIncidentLifecycle()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var seed = await SeedAsync(database);

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var command = new CreateIncidentCommand(
            seed.FacilityId,
            "Equipment failure",
            "Initial description",
            IncidentPriority.Medium,
            seed.AssetId);

        using var created = await client.PostAsJsonAsync(
            Route, command);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var incident = await created.Content
            .ReadFromJsonAsync<IncidentDto>();

        Assert.NotNull(incident);
        Assert.NotEqual(Guid.Empty, incident.Id);
        Assert.Equal(IncidentStatus.Open, incident.Status);
        Assert.Equal(seed.FacilityId, incident.FacilityId);
        Assert.Equal(seed.AssetId, incident.AssetId);

        Assert.NotNull(created.Headers.Location);

        using var read = await client.GetAsync(
            created.Headers.Location);

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);

        Assert.Equal(incident,
            await read.Content.ReadFromJsonAsync<IncidentDto>());

        var url = $"{Route}/{incident.Id}";

        using var updated = await client.PutAsJsonAsync(
            url, new UpdateIncidentCommand(
                "Updated incident",
                "Updated description",
                IncidentPriority.High));

        Assert.Equal(
            HttpStatusCode.NoContent, updated.StatusCode);

        var updatedIncident =
            await client.GetFromJsonAsync<IncidentDto>(url);

        Assert.NotNull(updatedIncident);
        Assert.Equal("Updated incident", updatedIncident.Title);
        Assert.Equal(IncidentPriority.High, updatedIncident.Priority);

        using var started = await client.PatchAsync(
            $"{url}/start", null);

        Assert.Equal(HttpStatusCode.NoContent, started.StatusCode);

        var inProgress =
            await client.GetFromJsonAsync<IncidentDto>(url);

        Assert.NotNull(inProgress);
        Assert.Equal(IncidentStatus.InProgress, inProgress.Status);

        using var resolved = await client.PatchAsync(
            $"{url}/resolve", null);

        Assert.Equal(HttpStatusCode.NoContent, resolved.StatusCode);

        var resolvedIncident =
            await client.GetFromJsonAsync<IncidentDto>(url);

        Assert.NotNull(resolvedIncident);
        Assert.Equal(IncidentStatus.Resolved, resolvedIncident.Status);
        Assert.NotNull(resolvedIncident.ResolvedAtUtc);

        using var closed = await client.PatchAsync(
            $"{url}/close", null);

        Assert.Equal(HttpStatusCode.NoContent, closed.StatusCode);

        var closedIncident =
            await client.GetFromJsonAsync<IncidentDto>(url);

        Assert.NotNull(closedIncident);
        Assert.Equal(IncidentStatus.Closed, closedIncident.Status);
        Assert.NotNull(closedIncident.ClosedAtUtc);

        using var reopened = await client.PatchAsync(
            $"{url}/reopen", null);

        Assert.Equal(HttpStatusCode.NoContent, reopened.StatusCode);

        var final = await client.GetFromJsonAsync<IncidentDto>(url);

        Assert.NotNull(final);
        Assert.Equal(IncidentStatus.Open, final.Status);
        Assert.Null(final.ResolvedAtUtc);
        Assert.Null(final.ClosedAtUtc);

        await using var db = database.CreateContext();

        var persisted = await db.Incidents.SingleAsync(
            item => item.Id == incident.Id);

        Assert.Equal(IncidentStatus.Open, persisted.Status);
        Assert.Equal(IncidentPriority.High, persisted.Priority);
        Assert.Equal("Updated incident", persisted.Title);
        Assert.Null(persisted.ResolvedAtUtc);
        Assert.Null(persisted.ClosedAtUtc);
    }

    [SqlServerFact]
    public async Task IncidentFilters_ReturnMatchingRecords()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var seed = await SeedAsync(database);

        var matching = new Incident(
            seed.FacilityId, "Matching incident",
            null, IncidentPriority.High, seed.AssetId);

        var otherPriority = new Incident(
            seed.FacilityId, "Low priority incident",
            null, IncidentPriority.Low, seed.AssetId);

        var otherStatus = new Incident(
            seed.FacilityId, "In progress incident",
            null, IncidentPriority.High, seed.AssetId);

        otherStatus.StartProgress();

        var otherAsset = new Incident(
            seed.FacilityId, "Incident without asset",
            null, IncidentPriority.High);

        var otherFacility = new Incident(
            seed.OtherFacilityId, "Other facility incident",
            null, IncidentPriority.High);

        await using (var db = database.CreateContext())
        {
            db.Incidents.AddRange(
                matching, otherPriority, otherStatus,
                otherAsset, otherFacility);

            await db.SaveChangesAsync();
        }

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var all = await client
            .GetFromJsonAsync<IncidentDto[]>(Route);

        Assert.NotNull(all);
        Assert.Equal(5, all.Length);

        var filtered = await client.GetFromJsonAsync<IncidentDto[]>(
            $"{Route}?facilityId={seed.FacilityId}" +
            $"&assetId={seed.AssetId}" +
            "&status=Open&priority=High");

        Assert.NotNull(filtered);
        Assert.Equal(matching.Id, Assert.Single(filtered).Id);

        using var invalidFilter = await client.GetAsync(
            $"{Route}?priority=999");

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidFilter.StatusCode);
    }

    [SqlServerFact]
    public async Task InvalidIncidentOperations_ReturnExpectedErrors()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var seed = await SeedAsync(database);

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var valid = new CreateIncidentCommand(
            seed.FacilityId, "Test incident",
            null, IncidentPriority.Medium, seed.AssetId);

        using var unknownFacility = await client.PostAsJsonAsync(
            Route, valid with
            {
                FacilityId = Guid.NewGuid()
            });

        Assert.Equal(
            HttpStatusCode.NotFound, unknownFacility.StatusCode);

        using var unknownAsset = await client.PostAsJsonAsync(
            Route, valid with
            {
                AssetId = Guid.NewGuid()
            });

        Assert.Equal(
            HttpStatusCode.NotFound, unknownAsset.StatusCode);

        using var mismatch = await client.PostAsJsonAsync(
            Route, valid with
            {
                FacilityId = seed.OtherFacilityId
            });

        Assert.Equal(
            HttpStatusCode.BadRequest, mismatch.StatusCode);

        using var invalidPriority = await client.PostAsJsonAsync(
            Route, valid with
            {
                Priority = (IncidentPriority)999
            });

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidPriority.StatusCode);

        using var created = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var incident = await created.Content
            .ReadFromJsonAsync<IncidentDto>();

        Assert.NotNull(incident);

        using var invalidTransition = await client.PatchAsync(
            $"{Route}/{incident.Id}/close", null);

        Assert.Equal(
            HttpStatusCode.Conflict, invalidTransition.StatusCode);

        using var missing = await client.GetAsync(
            $"{Route}/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        await using var db = database.CreateContext();

        var persisted = await db.Incidents.SingleAsync();

        Assert.Equal(incident.Id, persisted.Id);
        Assert.Equal(IncidentStatus.Open, persisted.Status);
    }
}
