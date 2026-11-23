namespace FieldOps.Application.Incidents;

public sealed class IncidentConcurrencyException : Exception
{
    public IncidentConcurrencyException(
        string message,
        Exception innerException)
        : base(message, innerException)
    {
    }
}