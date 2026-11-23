namespace FieldOps.Application.Incidents;

public sealed class IncidentAssetFacilityMismatchException : Exception
{
    public IncidentAssetFacilityMismatchException(
        Guid assetId,
        Guid facilityId)
        : base(
            $"Asset '{assetId}' does not belong " +
            $"to facility '{facilityId}'.")
    {
    }
}
