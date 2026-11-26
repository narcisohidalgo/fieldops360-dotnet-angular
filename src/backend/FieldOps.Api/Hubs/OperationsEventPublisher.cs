using FieldOps.Api.Security;
using FieldOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Api.Hubs;

public interface IOperationsEventPublisher
{
    Task WorkOrdersChangedAsync();
    Task IncidentsChangedAsync();
}

/// <summary>
/// Publica avisos sin datos privados.
/// Los clientes consultan los datos por REST.
/// </summary>
public sealed class OperationsEventPublisher
    : IOperationsEventPublisher
{
    public const string WorkOrdersChangedEvent =
        "WorkOrdersChanged";

    public const string IncidentsChangedEvent =
        "IncidentsChanged";

    private readonly IHubContext<OperationsHub> _hub;
    private readonly ILogger<OperationsEventPublisher> _logger;
    private readonly OperationsConnectionRegistry _connections;
    private readonly IServiceScopeFactory _scopeFactory;

    public OperationsEventPublisher(
        IHubContext<OperationsHub> hub,
        ILogger<OperationsEventPublisher> logger,
        OperationsConnectionRegistry connections,
        IServiceScopeFactory scopeFactory)
    {
        _hub = hub;
        _logger = logger;
        _connections = connections;
        _scopeFactory = scopeFactory;
    }

    public async Task IncidentsChangedAsync()
    {
        try
        {
            await SendToAuthorizedManagersAsync(
                IncidentsChangedEvent);
        }
        catch (Exception ex)
        {
            // La incidencia ya se ha guardado.
            // Un fallo de notificacion no debe provocar
            // una respuesta REST incorrecta.
            _logger.LogWarning(
                ex,
                "Incident persisted but realtime notification failed.");
        }
    }
    public async Task WorkOrdersChangedAsync()
    {
        try
        {
            await SendToAuthorizedManagersAsync(
                WorkOrdersChangedEvent);
        }
        catch (Exception ex)
        {
            // La orden ya se ha guardado.
            // Un fallo de notificacion no puede convertir
            // una operacion REST correcta en un falso error.
            _logger.LogWarning(
                ex,
                "Work order persisted but realtime notification failed.");
        }
    }

    /// <summary>
    /// Authorizes each connection against current persisted Identity
    /// state before publishing an operational notification.
    /// </summary>
    private async Task SendToAuthorizedManagersAsync(string eventName)
    {
        var connections = _connections.Snapshot();

        if (connections.Length == 0)
        {
            return;
        }

        var userIds = connections
            .Select(connection => connection.UserId)
            .Distinct()
            .ToArray();

        // Use a fresh scope, never an existing tracked Identity entity.
        await using var scope = _scopeFactory.CreateAsyncScope();

        var db = scope.ServiceProvider
            .GetRequiredService<FieldOpsDbContext>();

        var administratorRole =
            FieldOpsRoles.Administrator.ToUpperInvariant();

        var supervisorRole =
            FieldOpsRoles.Supervisor.ToUpperInvariant();

        // Resolve current authorization for all candidate users
        // with one database query.
        var authorizedUsers = await (
            from user in db.Users.AsNoTracking()
            join assignment in db.UserRoles
                on user.Id equals assignment.UserId
            join role in db.Roles
                on assignment.RoleId equals role.Id
            where userIds.Contains(user.Id) &&
                  user.IsActive &&
                  user.SecurityStamp != null &&
                  (role.NormalizedName == administratorRole ||
                   role.NormalizedName == supervisorRole)
            select new
            {
                user.Id,
                user.SecurityStamp
            }
        ).Distinct().ToListAsync();

        // Compare stamps in memory using exact string equality.
        // A previous connection must not inherit a newer session.
        var validSessions = authorizedUsers
            .Select(user => (user.Id, user.SecurityStamp))
            .ToHashSet();

        var authorizedConnectionIds = connections
            .Where(connection => validSessions.Contains(
                (connection.UserId, connection.SecurityStamp)))
            .Select(connection => connection.ConnectionId)
            .ToArray();

        if (authorizedConnectionIds.Length == 0)
        {
            return;
        }

        // No fallback to groups or broadcast is permitted.
        await _hub.Clients
            .Clients(authorizedConnectionIds)
            .SendAsync(eventName);
    }

}