namespace FieldOps.Application.Facilities;

public sealed class DuplicateFacilityCodeException : Exception
{
    public DuplicateFacilityCodeException(string code)
        : this(code, null)
    {
    }

    public DuplicateFacilityCodeException(
        string code,
        Exception? innerException)
        : base(
            $"A facility with code '{code}' already exists.",
            innerException)
    {
    }
}
