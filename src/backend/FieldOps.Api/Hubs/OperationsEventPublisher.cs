using Microsoft.AspNetCore.SignalR;

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

    public OperationsEventPublisher(
        IHubContext<OperationsHub> hub,
        ILogger<OperationsEventPublisher> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    public async Task IncidentsChangedAsync()
    {
        try
        {
            await _hub.Clients
                .Group(OperationsHub.ManagersGroup)
                .SendAsync(IncidentsChangedEvent);
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
            await _hub.Clients
                .Group(OperationsHub.ManagersGroup)
                .SendAsync(WorkOrdersChangedEvent);
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
}