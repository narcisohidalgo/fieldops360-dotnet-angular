namespace FieldOps.Application.Technicians;

public sealed class DuplicateTechnicianCodeException : Exception
{
    public DuplicateTechnicianCodeException(string code)
        : this(code, null)
    {
    }

    public DuplicateTechnicianCodeException(
        string code,
        Exception? innerException)
        : base(
            $"A technician with code '{code}' already exists.",
            innerException)
    {
    }
}
