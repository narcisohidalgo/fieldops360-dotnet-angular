using FieldOps.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;

namespace FieldOps.Api.Hubs;

/// <summary>
/// Canal de eventos operativos de FieldOps 360.
/// Solo el servidor publicara notificaciones.
/// </summary>
[Authorize(Policy = FieldOpsPolicies.ReadFacilitiesAndAssets)]
public sealed class OperationsHub : Hub
{
    public const string Route = "/hubs/operations";

    private readonly OperationsConnectionRegistry _connections;
    private readonly IdentityOptions _identityOptions;

    public OperationsHub(
        OperationsConnectionRegistry connections,
        IOptions<IdentityOptions> identityOptions)
    {
        _connections = connections;
        _identityOptions = identityOptions.Value;
    }

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;

        if (user is not null &&
            (user.IsInRole(FieldOpsRoles.Administrator) ||
             user.IsInRole(FieldOpsRoles.Supervisor)))
        {
            var userId = user.FindFirst(
                _identityOptions.ClaimsIdentity.UserIdClaimType)?.Value;

            var securityStamp = user.FindFirst(
                _identityOptions.ClaimsIdentity.SecurityStampClaimType)?.Value;

            if (Guid.TryParse(userId, out var id) &&
                id != Guid.Empty &&
                !string.IsNullOrWhiteSpace(securityStamp))
            {
                _connections.Register(
                    Context.ConnectionId,
                    id,
                    securityStamp);
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _connections.Remove(Context.ConnectionId);

        await base.OnDisconnectedAsync(exception);
    }
}