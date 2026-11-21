namespace FieldOps.Application.Facilities;

public sealed class DuplicateFacilityCodeException : Exception
{
    public DuplicateFacilityCodeException(string code)
        : base($"A facility with code '{code}' already exists.")
    {
    }
}
