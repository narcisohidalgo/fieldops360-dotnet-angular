namespace FieldOps.Application.Technicians;

public sealed class DuplicateTechnicianCodeException : Exception
{
    public DuplicateTechnicianCodeException(string code)
        : base($"A technician with code '{code}' already exists.")
    {
    }
}
