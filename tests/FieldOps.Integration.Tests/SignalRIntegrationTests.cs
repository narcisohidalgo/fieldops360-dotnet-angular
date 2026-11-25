using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using FieldOps.Api.Hubs;
using FieldOps.Api.Security;
using FieldOps.Application.Incidents;
using FieldOps.Application.WorkOrders;
using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Integration.Tests;

public sealed class SignalRIntegrationTests
{
    private const string ProbeEvent = "IntegrationProbe";

    [Fact]
    public async Task AnonymousConnection_IsRejected()
    {
        await using var factory = new FieldOpsApiFactory();

        using var client = factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                BaseAddress = new Uri("https://localhost")
            });

        using var response = await client.PostAsync(
            $"{OperationsHub.Route}/negotiate?negotiateVersion=1",
            null);

        Assert.Equal(
            HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [SqlServerFact]
    public async Task SuccessfulMutations_NotifyManagersButNotTechnicians()
    {
        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var facility = new Facility(
            "FAC-001", "Test Facility", "Cordoba");

        var technician = new Technician(
            "TEC-001", "Test Technician",
            "technician@example.invalid");

        await using (var db = database.CreateContext())
        {
            db.Facilities.Add(facility);
            db.Technicians.Add(technician);

            await db.SaveChangesAsync();
        }

        var admin = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        var supervisor = await factory.CreateUserAsync(
            FieldOpsRoles.Supervisor);

        var technicianUser = await factory.CreateUserAsync(
            FieldOpsRoles.Technician, technician.Id);

        using var adminClient = factory.CreateSessionClient();
        using var supervisorClient = factory.CreateSessionClient();
        using var technicianClient = factory.CreateSessionClient();

        await using var adminHub = await CreateConnectionAsync(
            factory, adminClient, admin.Email, admin.Password);

        await using var supervisorHub = await CreateConnectionAsync(
            factory, supervisorClient,
            supervisor.Email, supervisor.Password);

        await using var technicianHub = await CreateConnectionAsync(
            factory, technicianClient,
            technicianUser.Email, technicianUser.Password);

        var adminEvents = new ConcurrentQueue<string>();
        var supervisorEvents = new ConcurrentQueue<string>();
        var technicianEvents = new ConcurrentQueue<string>();

        Subscribe(adminHub, adminEvents);
        Subscribe(supervisorHub, supervisorEvents);
        Subscribe(technicianHub, technicianEvents);

        using var timeout =
            new CancellationTokenSource(TimeSpan.FromSeconds(30));

        await StartAndVerifyAsync(adminHub, timeout.Token);
        await StartAndVerifyAsync(supervisorHub, timeout.Token);
        await StartAndVerifyAsync(technicianHub, timeout.Token);

        var incident = new CreateIncidentCommand(
            facility.Id, "SignalR test incident",
            null, IncidentPriority.High);

        // Una operacion rechazada no debe publicar eventos.
        using var rejected = await adminClient.PostAsJsonAsync(
            "/api/incidents",
            incident with { FacilityId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.NotFound, rejected.StatusCode);

        await SynchronizeAsync(
            factory, timeout.Token,
            adminHub, supervisorHub, technicianHub);

        Assert.Empty(adminEvents);
        Assert.Empty(supervisorEvents);
        Assert.Empty(technicianEvents);

        // Crear una incidencia mediante la API real.
        using var createdIncident = await adminClient.PostAsJsonAsync(
            "/api/incidents", incident);

        Assert.Equal(
            HttpStatusCode.Created, createdIncident.StatusCode);

        // Crear una orden de trabajo mediante la API real.
        var workOrder = new CreateWorkOrderCommand(
            facility.Id, "WO-001", "SignalR test order",
            null, WorkOrderPriority.High,
            TechnicianId: technician.Id);

        using var createdOrder = await adminClient.PostAsJsonAsync(
            "/api/work-orders", workOrder);

        Assert.Equal(
            HttpStatusCode.Created, createdOrder.StatusCode);

        await SynchronizeAsync(
            factory, timeout.Token,
            adminHub, supervisorHub, technicianHub);

        var expected = new[]
        {
            OperationsEventPublisher.IncidentsChangedEvent,
            OperationsEventPublisher.WorkOrdersChangedEvent
        };

        Assert.Equal(expected, adminEvents.ToArray());
        Assert.Equal(expected, supervisorEvents.ToArray());

        // El tecnico esta conectado, pero no pertenece al grupo.
        Assert.Empty(technicianEvents);

        await using var verification = database.CreateContext();

        Assert.Equal(1, await verification.Incidents.CountAsync());
        Assert.Equal(1, await verification.WorkOrders.CountAsync());
    }

    private static async Task<HubConnection> CreateConnectionAsync(
        SqlServerApiFactory factory,
        HttpClient client,
        string email,
        string password)
    {
        await SqlServerApiFactory.RefreshCsrfAsync(client);

        using var login = await client.PostAsJsonAsync(
            "/api/auth/login", new { email, password });

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        Assert.True(login.Headers.TryGetValues(
            "Set-Cookie", out var cookies));

        var authCookie = Assert.Single(cookies!, cookie =>
            cookie.StartsWith(
                "FieldOps.Auth=", StringComparison.Ordinal));

        var cookieHeader = authCookie.Split(';')[0];

        await SqlServerApiFactory.RefreshCsrfAsync(client);

        return new HubConnectionBuilder()
            .WithUrl(
                $"https://localhost{OperationsHub.Route}",
                options =>
                {
                    options.Transports =
                        HttpTransportType.LongPolling;

                    options.Headers["Cookie"] = cookieHeader;

                    options.HttpMessageHandlerFactory =
                        _ => factory.Server.CreateHandler();
                })
            .Build();
    }

    private static void Subscribe(
        HubConnection connection,
        ConcurrentQueue<string> events)
    {
        connection.On(
            OperationsEventPublisher.IncidentsChangedEvent,
            () => events.Enqueue(
                OperationsEventPublisher.IncidentsChangedEvent));

        connection.On(
            OperationsEventPublisher.WorkOrdersChangedEvent,
            () => events.Enqueue(
                OperationsEventPublisher.WorkOrdersChangedEvent));
    }

    private static async Task StartAndVerifyAsync(
        HubConnection connection,
        CancellationToken cancellationToken)
    {
        await connection.StartAsync(cancellationToken);

        Assert.Equal(
            HubConnectionState.Connected, connection.State);

        // Los clientes no pueden invocar eventos del servidor.
        // Tambien confirma que el hub procesa invocaciones.
        await Assert.ThrowsAsync<HubException>(() =>
            connection.InvokeAsync(
                OperationsEventPublisher.IncidentsChangedEvent,
                cancellationToken));
    }

    private static async Task SynchronizeAsync(
        SqlServerApiFactory factory,
        CancellationToken cancellationToken,
        params HubConnection[] connections)
    {
        var completions = connections.Select(_ =>
            new TaskCompletionSource<bool>(
                TaskCreationOptions.RunContinuationsAsynchronously))
            .ToArray();

        var subscriptions = connections.Select((connection, index) =>
            connection.On(ProbeEvent, () =>
            {
                completions[index].TrySetResult(true);
            }))
            .ToArray();

        try
        {
            var hub = factory.Services
                .GetRequiredService<IHubContext<OperationsHub>>();

            // Evento exclusivo de pruebas para confirmar que
            // todos los clientes procesaron los mensajes previos.
            await hub.Clients.All.SendAsync(
                ProbeEvent, cancellationToken);

            await Task.WhenAll(
                completions.Select(item => item.Task))
                .WaitAsync(cancellationToken);
        }
        finally
        {
            foreach (var subscription in subscriptions)
            {
                subscription.Dispose();
            }
        }
    }
}
