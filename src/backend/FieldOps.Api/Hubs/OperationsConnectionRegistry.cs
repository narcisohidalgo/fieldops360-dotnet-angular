using System.Collections.Concurrent;

namespace FieldOps.Api.Hubs;

/// <summary>
/// Authentication snapshot associated with one SignalR connection.
/// The security stamp is never exposed to clients or logs.
/// </summary>
public sealed record OperationsConnection(
    string ConnectionId,
    Guid UserId,
    string SecurityStamp);

/// <summary>
/// Tracks manager connections in the current application instance.
/// Registration alone does not authorize future notifications.
/// </summary>
public sealed class OperationsConnectionRegistry
{
    private readonly ConcurrentDictionary<string, OperationsConnection>
        _connections = new(StringComparer.Ordinal);

    public void Register(
        string connectionId,
        Guid userId,
        string securityStamp)
    {
        _connections[connectionId] = new OperationsConnection(
            connectionId,
            userId,
            securityStamp);
    }

    public void Remove(string connectionId)
    {
        _connections.TryRemove(connectionId, out _);
    }

    public OperationsConnection[] Snapshot()
    {
        return _connections.Values.ToArray();
    }
}
