using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Security;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Application.Facilities;
using FieldOps.Application.Assets;
using FieldOps.Application.Incidents;
using FieldOps.Application.Technicians;
using FieldOps.Application.WorkOrders;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class AuthorizationIntegrationTests
{
    [SqlServerFact]
    public async Task ReadEndpoints_EnforceRolePermissions()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var technician = new Technician(
            "TEC-001", "Test Technician",
            "technician@example.invalid");

        await using (var db = database.CreateContext())
        {
            db.Technicians.Add(technician);
            await db.SaveChangesAsync();
        }

        var endpoints = new[]
        {
            "/api/facilities",
            "/api/assets",
            "/api/incidents",
            "/api/technicians",
            "/api/work-orders",
            "/api/dashboard/summary",
            "/api/users"
        };

        var roles = new[]
        {
            FieldOpsRoles.Administrator,
            FieldOpsRoles.Supervisor,
            FieldOpsRoles.Technician
        };

        foreach (var role in roles)
        {
            var user = await factory.CreateUserAsync(
                role,
                role == FieldOpsRoles.Technician
                    ? technician.Id
                    : null);

            using var client = factory.CreateSessionClient();

            await SqlServerApiFactory.LoginAsync(
                client, user.Email, user.Password);

            foreach (var endpoint in endpoints)
            {
                var allowed = role switch
                {
                    FieldOpsRoles.Administrator => true,

                    FieldOpsRoles.Supervisor =>
                        endpoint != "/api/users",

                    FieldOpsRoles.Technician =>
                        endpoint is "/api/facilities" or "/api/assets",

                    _ => false
                };

                var expected = allowed
                    ? HttpStatusCode.OK
                    : HttpStatusCode.Forbidden;

                using var response =
                    await client.GetAsync(endpoint);

                Assert.True(
                    response.StatusCode == expected,
                    $"{role} GET {endpoint}: " +
                    $"expected {(int)expected}, " +
                    $"received {(int)response.StatusCode}");
            }
        }
    }

    [SqlServerFact]
    public async Task UnauthorizedMutations_DoNotModifyDatabase()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var facility = new Facility(
            "FAC-001", "Existing Facility", "Cordoba");

        var technician = new Technician(
            "TEC-001", "Existing Technician",
            "technician@example.invalid");

        await using (var db = database.CreateContext())
        {
            db.Facilities.Add(facility);
            db.Technicians.Add(technician);

            await db.SaveChangesAsync();
        }

        var facilityCommand = new CreateFacilityCommand(
            "FAC-002", "Forbidden Facility", "Sevilla", null);

        var supervisor = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        using (var client = factory.CreateSessionClient())
        {
            await SqlServerApiFactory.LoginAsync(
                client, supervisor.Email, supervisor.Password);

            using var response = await client.PostAsJsonAsync(
                "/api/facilities", facilityCommand);

            Assert.Equal(
                HttpStatusCode.Forbidden, response.StatusCode);

            using var deactivate = await client.PatchAsync(
                $"/api/facilities/{facility.Id}/deactivate", null);

            Assert.Equal(
                HttpStatusCode.Forbidden, deactivate.StatusCode);
        }

        var technicianUser = await factory.CreateUserAsync(
            FieldOpsRoles.Technician, technician.Id);

        using (var client = factory.CreateSessionClient())
        {
            await SqlServerApiFactory.LoginAsync(
                client,
                technicianUser.Email,
                technicianUser.Password);

            var mutations = new (string Route, object Body)[]
            {
                ("/api/facilities", facilityCommand),

                ("/api/assets", new CreateAssetCommand(
                    facility.Id, "AST-001", "Forbidden Asset", null)),

                ("/api/incidents", new CreateIncidentCommand(
                    facility.Id, "Forbidden Incident",
                    null, IncidentPriority.High)),

                ("/api/technicians", new CreateTechnicianCommand(
                    "TEC-002", "Forbidden Technician",
                    "other@example.invalid", null, null)),

                ("/api/work-orders", new CreateWorkOrderCommand(
                    facility.Id, "WO-001", "Forbidden Work Order",
                    null, WorkOrderPriority.High))
            };

            foreach (var mutation in mutations)
            {
                using var response = await client.PostAsJsonAsync(
                    mutation.Route, mutation.Body);

                Assert.True(
                    response.StatusCode == HttpStatusCode.Forbidden,
                    $"Technician POST {mutation.Route}: " +
                    $"received {(int)response.StatusCode}");
            }
        }

        // Confirmar que ninguna operacion prohibida se persistio.
        await using var verification = database.CreateContext();

        var storedFacility =
            await verification.Facilities.SingleAsync();

        Assert.Equal(facility.Id, storedFacility.Id);
        Assert.True(storedFacility.IsActive);

        var storedTechnician =
            await verification.Technicians.SingleAsync();

        Assert.Equal(technician.Id, storedTechnician.Id);

        Assert.False(await verification.Assets.AnyAsync());
        Assert.False(await verification.Incidents.AnyAsync());
        Assert.False(await verification.WorkOrders.AnyAsync());
    }
}
