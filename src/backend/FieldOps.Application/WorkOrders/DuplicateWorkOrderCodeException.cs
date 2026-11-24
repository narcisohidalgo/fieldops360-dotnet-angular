namespace FieldOps.Application.WorkOrders;

public sealed class DuplicateWorkOrderCodeException : Exception
{
    public DuplicateWorkOrderCodeException(string code)
        : base($"Work order code '{code}' already exists.")
    {
    }
}
