namespace FieldOps.Application.Incidents;

public sealed class IncidentFacilityNotFoundException : Exception
{
    public IncidentFacilityNotFoundException(Guid facilityId)
        : base($"Facility '{facilityId}' was not found.")
    {
    }
}
