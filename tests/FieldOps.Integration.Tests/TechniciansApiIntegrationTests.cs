using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Security;
using FieldOps.Application.Technicians;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class TechniciansApiIntegrationTests
{
    private const string Route = "/api/technicians";

    [SqlServerFact]
    public async Task Supervisor_CanManageTechnicianLifecycle()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var user = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        using var client = factory.CreateSessionClient();

        await SqlServerApiFactory.LoginAsync(
            client, user.Email, user.Password);

        var command = new CreateTechnicianCommand(
            "TEC-001",
            "Test Technician",
            "technician@example.invalid",
            "600000001",
            "Electrical maintenance");

        using var created = await client.PostAsJsonAsync(
            Route, command);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var technician = await created.Content
            .ReadFromJsonAsync<TechnicianDto>();

        Assert.NotNull(technician);
        Assert.NotEqual(Guid.Empty, technician.Id);
        Assert.Equal(command.Code, technician.Code);
        Assert.Equal(command.Name, technician.Name);
        Assert.Equal(command.Email, technician.Email);
        Assert.Equal(command.Phone, technician.Phone);
        Assert.Equal(command.Specialty, technician.Specialty);
        Assert.True(technician.IsActive);

        Assert.NotNull(created.Headers.Location);

        using var read = await client.GetAsync(
            created.Headers.Location);

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);

        Assert.Equal(technician,
            await read.Content.ReadFromJsonAsync<TechnicianDto>());

        var url = $"{Route}/{technician.Id}";

        var update = new UpdateTechnicianCommand(
            "Updated Technician",
            "updated@example.invalid",
            "600000002",
            "Mechanical maintenance");

        using var updated = await client.PutAsJsonAsync(
            url, update);

        Assert.Equal(
            HttpStatusCode.NoContent, updated.StatusCode);

        using var deactivated = await client.PatchAsync(
            $"{url}/deactivate", null);

        Assert.Equal(
            HttpStatusCode.NoContent, deactivated.StatusCode);

        var inactive =
            await client.GetFromJsonAsync<TechnicianDto>(url);

        Assert.NotNull(inactive);
        Assert.False(inactive.IsActive);
        Assert.Equal(update.Name, inactive.Name);

        using var activated = await client.PatchAsync(
            $"{url}/activate", null);

        Assert.Equal(
            HttpStatusCode.NoContent, activated.StatusCode);

        var technicians = await client
            .GetFromJsonAsync<TechnicianDto[]>(Route);

        Assert.NotNull(technicians);

        var final = Assert.Single(technicians);

        Assert.Equal(technician.Id, final.Id);
        Assert.Equal(command.Code, final.Code);
        Assert.Equal(update.Name, final.Name);
        Assert.Equal(update.Email, final.Email);
        Assert.Equal(update.Phone, final.Phone);
        Assert.Equal(update.Specialty, final.Specialty);
        Assert.True(final.IsActive);

        await using var db = database.CreateContext();

        var persisted = await db.Technicians.SingleAsync(
            item => item.Id == technician.Id);

        Assert.Equal(command.Code, persisted.Code);
        Assert.Equal(update.Name, persisted.Name);
        Assert.Equal(update.Email, persisted.Email);
        Assert.Equal(update.Phone, persisted.Phone);
        Assert.Equal(update.Specialty, persisted.Specialty);
        Assert.True(persisted.IsActive);
    }

    [SqlServerFact]
    public async Task InvalidDuplicateAndUnknownTechnician_ReturnExpectedErrors()
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

        var valid = new CreateTechnicianCommand(
            "TEC-001",
            "Test Technician",
            "technician@example.invalid",
            null,
            null);

        using var created = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var technician = await created.Content
            .ReadFromJsonAsync<TechnicianDto>();

        Assert.NotNull(technician);

        using var duplicate = await client.PostAsJsonAsync(
            Route, valid);

        Assert.Equal(
            HttpStatusCode.Conflict, duplicate.StatusCode);

        using var invalidEmail = await client.PostAsJsonAsync(
            Route, valid with
            {
                Code = "TEC-002",
                Email = "invalid-email"
            });

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidEmail.StatusCode);

        using var invalidName = await client.PostAsJsonAsync(
            Route, valid with
            {
                Code = "TEC-003",
                Name = ""
            });

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidName.StatusCode);

        using var invalidUpdate = await client.PutAsJsonAsync(
            $"{Route}/{technician.Id}",
            new UpdateTechnicianCommand(
                "Invalid update", "invalid-email", null, null));

        Assert.Equal(
            HttpStatusCode.BadRequest, invalidUpdate.StatusCode);

        var missingUrl = $"{Route}/{Guid.NewGuid()}";

        using var missing = await client.GetAsync(missingUrl);

        Assert.Equal(
            HttpStatusCode.NotFound, missing.StatusCode);

        using var missingUpdate = await client.PutAsJsonAsync(
            missingUrl,
            new UpdateTechnicianCommand(
                "Unknown technician",
                "unknown@example.invalid",
                null,
                null));

        Assert.Equal(
            HttpStatusCode.NotFound, missingUpdate.StatusCode);

        using var missingDeactivate = await client.PatchAsync(
            $"{missingUrl}/deactivate", null);

        Assert.Equal(
            HttpStatusCode.NotFound, missingDeactivate.StatusCode);

        await using var db = database.CreateContext();

        var persisted = await db.Technicians.SingleAsync();

        Assert.Equal(technician.Id, persisted.Id);
        Assert.Equal(valid.Name, persisted.Name);
        Assert.Equal(valid.Email, persisted.Email);
        Assert.True(persisted.IsActive);
    }
}
