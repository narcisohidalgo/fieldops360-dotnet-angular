namespace FieldOps.Application.Incidents;

public sealed class IncidentAssetNotFoundException : Exception
{
    public IncidentAssetNotFoundException(Guid assetId)
        : base($"Asset '{assetId}' was not found.")
    {
    }
}
