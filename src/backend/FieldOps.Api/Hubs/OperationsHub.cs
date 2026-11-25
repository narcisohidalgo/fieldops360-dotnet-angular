using FieldOps.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace FieldOps.Api.Hubs;

/// <summary>
/// Canal de eventos operativos de FieldOps 360.
/// Solo el servidor publicara notificaciones.
/// </summary>
[Authorize(Policy = FieldOpsPolicies.ReadFacilitiesAndAssets)]
public sealed class OperationsHub : Hub
{
    public const string Route = "/hubs/operations";

    // Solo Administrator y Supervisor reciben eventos generales
    // dirigidos al grupo de responsables operativos.
    public const string ManagersGroup = "operations:managers";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;

        if (user?.IsInRole(FieldOpsRoles.Administrator) == true ||
            user?.IsInRole(FieldOpsRoles.Supervisor) == true)
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                ManagersGroup,
                Context.ConnectionAborted);
        }

        await base.OnConnectedAsync();
    }
}