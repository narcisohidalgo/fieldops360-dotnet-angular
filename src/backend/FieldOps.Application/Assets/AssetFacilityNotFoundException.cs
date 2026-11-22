namespace FieldOps.Application.Assets;

public sealed class AssetFacilityNotFoundException : Exception
{
    public AssetFacilityNotFoundException(Guid facilityId)
        : base($"Facility '{facilityId}' was not found.")
    {
    }
}
