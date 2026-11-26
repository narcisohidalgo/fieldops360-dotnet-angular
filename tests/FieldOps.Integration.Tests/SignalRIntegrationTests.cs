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

    [SqlServerFact]
    public async Task DeactivatedSupervisor_StopsReceivingOperationalEvents()
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
        using var supervisorClient = factory.CreateSessionClient();

        await using var adminHub = await CreateConnectionAsync(
            factory,
            adminClient,
            admin.Email,
            admin.Password,
            useWebSockets: true);

        await using var supervisorHub = await CreateConnectionAsync(
            factory,
            supervisorClient,
            supervisor.Email,
            supervisor.Password,
            useWebSockets: true);

        var supervisorAccount = await supervisorClient
            .GetFromJsonAsync<FieldOps.Api.Controllers.AuthUserResponse>(
                "/api/auth/me");

        Assert.NotNull(supervisorAccount);

        var adminEvents = new ConcurrentQueue<string>();
        var supervisorEvents = new ConcurrentQueue<string>();

        Subscribe(adminHub, adminEvents);
        Subscribe(supervisorHub, supervisorEvents);

        using var timeout =
            new CancellationTokenSource(TimeSpan.FromSeconds(30));

        await StartAndVerifyAsync(adminHub, timeout.Token);
        await StartAndVerifyAsync(supervisorHub, timeout.Token);

        var publisher = factory.Services
            .GetRequiredService<IOperationsEventPublisher>();

        var expected = new[]
        {
            OperationsEventPublisher.IncidentsChangedEvent,
            OperationsEventPublisher.WorkOrdersChangedEvent
        };

        // Both connections must receive events before revocation.
        await publisher.IncidentsChangedAsync();
        await publisher.WorkOrdersChangedAsync();

        await SynchronizeAsync(
            factory,
            timeout.Token,
            adminHub,
            supervisorHub);

        Assert.Equal(expected, adminEvents.ToArray());
        Assert.Equal(expected, supervisorEvents.ToArray());

        adminEvents.Clear();
        supervisorEvents.Clear();

        // Revoke the supervisor account through the real REST API.
        using var deactivated = await adminClient.PatchAsync(
            $"/api/users/{supervisorAccount.Id}/deactivate",
            null,
            timeout.Token);

        Assert.Equal(HttpStatusCode.OK, deactivated.StatusCode);

        // Confirm the previous HTTP session is no longer valid.
        using var rejectedSession = await supervisorClient.GetAsync(
            "/api/auth/me", timeout.Token);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            rejectedSession.StatusCode);

        // Do not voluntarily disconnect the revoked WebSocket.
        // Publication must respect server-side authorization.
        await publisher.IncidentsChangedAsync();
        await publisher.WorkOrdersChangedAsync();

        // Confirm that both connected clients processed earlier messages.
        // This probe is test-only and contains no operational information.
        await SynchronizeAsync(
            factory,
            timeout.Token,
            adminHub,
            supervisorHub);

        // The administrator must continue receiving notifications.
        Assert.Equal(expected, adminEvents.ToArray());

        // The revoked supervisor must receive no operational events.
        Assert.True(
            supervisorEvents.IsEmpty,
            "AUD-009: revoked supervisor received operational events.");
    }


    [SqlServerFact]
    public Task DemotedSupervisor_LosesOperationalEventsAcrossConnections()
    {
        return VerifySessionRevocationAsync(
            RevocationScenario.RoleChange);
    }

    [SqlServerFact]
    public Task PasswordReset_RevokesOldConnectionsButAllowsNewSession()
    {
        return VerifySessionRevocationAsync(
            RevocationScenario.PasswordReset);
    }

    [SqlServerFact]
    public Task ReactivatedSupervisor_RequiresFreshSessionForOperationalEvents()
    {
        return VerifySessionRevocationAsync(
            RevocationScenario.DeactivateAndReactivate);
    }

    private enum RevocationScenario
    {
        RoleChange,
        PasswordReset,
        DeactivateAndReactivate
    }

    private static async Task VerifySessionRevocationAsync(
        RevocationScenario scenario)
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

        using var firstOldClient = factory.CreateSessionClient();

        using var secondOldClient = factory.CreateSessionClient();

        await using var adminHub = await CreateConnectionAsync(
            factory,
            adminClient,
            admin.Email,
            admin.Password,
            useWebSockets: true);

        await using var firstOldHub = await CreateConnectionAsync(
            factory,
            firstOldClient,
            supervisor.Email,
            supervisor.Password,
            useWebSockets: true);

        await using var secondOldHub = await CreateConnectionAsync(
            factory,
            secondOldClient,
            supervisor.Email,
            supervisor.Password,
            useWebSockets: true);

        var account = await firstOldClient
            .GetFromJsonAsync<FieldOps.Api.Controllers.AuthUserResponse>(
                "/api/auth/me");

        Assert.NotNull(account);

        var secondAccount = await secondOldClient
            .GetFromJsonAsync<FieldOps.Api.Controllers.AuthUserResponse>(
                "/api/auth/me");

        Assert.NotNull(secondAccount);
        Assert.Equal(account.Id, secondAccount.Id);

        var adminEvents = new ConcurrentQueue<string>();
        var firstOldEvents = new ConcurrentQueue<string>();
        var secondOldEvents = new ConcurrentQueue<string>();

        Subscribe(adminHub, adminEvents);
        Subscribe(firstOldHub, firstOldEvents);
        Subscribe(secondOldHub, secondOldEvents);

        using var timeout =
            new CancellationTokenSource(TimeSpan.FromSeconds(45));

        await StartAndVerifyAsync(adminHub, timeout.Token);
        await StartAndVerifyAsync(firstOldHub, timeout.Token);
        await StartAndVerifyAsync(secondOldHub, timeout.Token);

        var publisher = factory.Services
            .GetRequiredService<IOperationsEventPublisher>();

        // All three connections are authorized initially.
        await AssertOperationalDeliveryAsync(
            factory,
            publisher,
            timeout.Token,
            (adminHub, adminEvents, true),
            (firstOldHub, firstOldEvents, true),
            (secondOldHub, secondOldEvents, true));

        var userUrl = $"/api/users/{account.Id}";

        var currentPassword = supervisor.Password;

        switch (scenario)
        {
            case RevocationScenario.RoleChange:
            {
                var technician = new Technician(
                    "TEC-AUD009",
                    "Audit Technician",
                    "audit-technician@example.invalid");

                await using (var db = database.CreateContext())
                {
                    db.Technicians.Add(technician);
                    await db.SaveChangesAsync(timeout.Token);
                }

                // Ensure the target role exists without linking
                // the technician to another account.
                await using (var scope =
                    factory.Services.CreateAsyncScope())
                {
                    var roles = scope.ServiceProvider
                        .GetRequiredService<
                            Microsoft.AspNetCore.Identity.RoleManager<
                                Microsoft.AspNetCore.Identity.IdentityRole<Guid>>>();

                    if (!await roles.RoleExistsAsync(
                        FieldOpsRoles.Technician))
                    {
                        var created = await roles.CreateAsync(
                            new Microsoft.AspNetCore.Identity.IdentityRole<Guid>(
                                FieldOpsRoles.Technician));

                        Assert.True(created.Succeeded);
                    }
                }

                using var updated = await adminClient.PutAsJsonAsync(
                    userUrl,
                    new FieldOps.Api.Controllers.UpdateManagedUserRequest
                    {
                        DisplayName = "Demoted Supervisor",
                        Role = FieldOpsRoles.Technician,
                        TechnicianId = technician.Id
                    },
                    timeout.Token);

                Assert.Equal(HttpStatusCode.OK, updated.StatusCode);

                var updatedAccount = await updated.Content
                    .ReadFromJsonAsync<
                        FieldOps.Api.Controllers.ManagedUserDto>(
                            cancellationToken: timeout.Token);

                Assert.NotNull(updatedAccount);
                Assert.True(updatedAccount.IsActive);

                Assert.Equal(
                    FieldOpsRoles.Technician,
                    Assert.Single(updatedAccount.Roles));

                Assert.Equal(
                    technician.Id,
                    updatedAccount.TechnicianId);

                break;
            }

            case RevocationScenario.PasswordReset:
            {
                currentPassword = $"Aa1!{Guid.NewGuid():N}";

                using var reset = await adminClient.PostAsJsonAsync(
                    $"{userUrl}/reset-password",
                    new FieldOps.Api.Controllers.ResetManagedUserPasswordRequest
                    {
                        NewPassword = currentPassword
                    },
                    timeout.Token);

                Assert.Equal(
                    HttpStatusCode.NoContent,
                    reset.StatusCode);

                break;
            }

            case RevocationScenario.DeactivateAndReactivate:
            {
                using var deactivated = await adminClient.PatchAsync(
                    $"{userUrl}/deactivate",
                    null,
                    timeout.Token);

                Assert.Equal(
                    HttpStatusCode.OK,
                    deactivated.StatusCode);

                var inactiveAccount = await deactivated.Content
                    .ReadFromJsonAsync<
                        FieldOps.Api.Controllers.ManagedUserDto>(
                            cancellationToken: timeout.Token);

                Assert.NotNull(inactiveAccount);
                Assert.False(inactiveAccount.IsActive);

                break;
            }

            default:
                throw new ArgumentOutOfRangeException(
                    nameof(scenario));
        }

        // Both original HTTP sessions must be invalidated.
        using var firstRejected = await firstOldClient.GetAsync(
            "/api/auth/me", timeout.Token);

        using var secondRejected = await secondOldClient.GetAsync(
            "/api/auth/me", timeout.Token);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            firstRejected.StatusCode);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            secondRejected.StatusCode);

        // Both WebSockets remain open but must receive
        // no further restricted operational events.
        await AssertOperationalDeliveryAsync(
            factory,
            publisher,
            timeout.Token,
            (adminHub, adminEvents, true),
            (firstOldHub, firstOldEvents, false),
            (secondOldHub, secondOldEvents, false));

        if (scenario == RevocationScenario.DeactivateAndReactivate)
        {
            using var activated = await adminClient.PatchAsync(
                $"{userUrl}/activate",
                null,
                timeout.Token);

            Assert.Equal(
                HttpStatusCode.OK,
                activated.StatusCode);

            var activeAccount = await activated.Content
                .ReadFromJsonAsync<
                    FieldOps.Api.Controllers.ManagedUserDto>(
                        cancellationToken: timeout.Token);

            Assert.NotNull(activeAccount);
            Assert.True(activeAccount.IsActive);

            // Reactivation alone must never restore old connections.
            await AssertOperationalDeliveryAsync(
                factory,
                publisher,
                timeout.Token,
                (adminHub, adminEvents, true),
                (firstOldHub, firstOldEvents, false),
                (secondOldHub, secondOldEvents, false));
        }

        if (scenario == RevocationScenario.PasswordReset)
        {
            using var rejectedClient =
                factory.CreateSessionClient();

            await SqlServerApiFactory.RefreshCsrfAsync(
                rejectedClient);

            using var oldPasswordLogin =
                await rejectedClient.PostAsJsonAsync(
                    "/api/auth/login",
                    new
                    {
                        email = supervisor.Email,
                        password = supervisor.Password
                    },
                    timeout.Token);

            Assert.Equal(
                HttpStatusCode.Unauthorized,
                oldPasswordLogin.StatusCode);
        }

        // Authenticate again and establish a new independent connection.
        using var freshClient = factory.CreateSessionClient();

        await using var freshHub = await CreateConnectionAsync(
            factory,
            freshClient,
            supervisor.Email,
            currentPassword,
            useWebSockets: true);

        var freshAccount = await freshClient
            .GetFromJsonAsync<FieldOps.Api.Controllers.AuthUserResponse>(
                "/api/auth/me",
                timeout.Token);

        Assert.NotNull(freshAccount);
        Assert.Equal(account.Id, freshAccount.Id);

        var expectedRole =
            scenario == RevocationScenario.RoleChange
                ? FieldOpsRoles.Technician
                : FieldOpsRoles.Supervisor;

        Assert.Equal(
            expectedRole,
            Assert.Single(freshAccount.Roles));

        var freshEvents = new ConcurrentQueue<string>();

        Subscribe(freshHub, freshEvents);

        await StartAndVerifyAsync(freshHub, timeout.Token);

        // New manager sessions receive notifications.
        // New technician sessions and all old sessions do not.
        await AssertOperationalDeliveryAsync(
            factory,
            publisher,
            timeout.Token,
            (adminHub, adminEvents, true),
            (firstOldHub, firstOldEvents, false),
            (secondOldHub, secondOldEvents, false),
            (freshHub, freshEvents,
                scenario != RevocationScenario.RoleChange));
    }

    private static async Task AssertOperationalDeliveryAsync(
        SqlServerApiFactory factory,
        IOperationsEventPublisher publisher,
        CancellationToken cancellationToken,
        params (
            HubConnection Hub,
            ConcurrentQueue<string> Events,
            bool Receives
        )[] recipients)
    {
        foreach (var recipient in recipients)
        {
            recipient.Events.Clear();
        }

        await publisher.IncidentsChangedAsync();
        await publisher.WorkOrdersChangedAsync();

        // The test-only probe confirms that each connection
        // processed all earlier messages before assertions.
        await SynchronizeAsync(
            factory,
            cancellationToken,
            recipients.Select(item => item.Hub).ToArray());

        var expected = new[]
        {
            OperationsEventPublisher.IncidentsChangedEvent,
            OperationsEventPublisher.WorkOrdersChangedEvent
        };

        foreach (var recipient in recipients)
        {
            if (recipient.Receives)
            {
                Assert.Equal(
                    expected,
                    recipient.Events.ToArray());
            }
            else
            {
                Assert.Empty(recipient.Events);
            }
        }
    }


    private static async Task<HubConnection> CreateConnectionAsync(
        SqlServerApiFactory factory,
        HttpClient client,
        string email,
        string password,
        bool useWebSockets = false)
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
                    options.Headers["Cookie"] = cookieHeader;

                    options.HttpMessageHandlerFactory =
                        _ => factory.Server.CreateHandler();

                    if (useWebSockets)
                    {
                        options.Transports =
                            HttpTransportType.WebSockets;

                        options.SkipNegotiation = true;

                        options.WebSocketFactory =
                            async (context, cancellationToken) =>
                            {
                                var webSocketClient =
                                    factory.Server.CreateWebSocketClient();

                                webSocketClient.ConfigureRequest =
                                    request =>
                                    {
                                        request.Headers["Cookie"] =
                                            cookieHeader;
                                    };

                                return await webSocketClient.ConnectAsync(
                                    context.Uri, cancellationToken);
                            };
                    }
                    else
                    {
                        options.Transports =
                            HttpTransportType.LongPolling;
                    }
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
