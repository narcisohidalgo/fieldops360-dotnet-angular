namespace FieldOps.Application.WorkOrders;

public sealed class WorkOrderConcurrencyException : Exception
{
    public WorkOrderConcurrencyException(
        string message,
        Exception innerException)
        : base(message, innerException)
    {
    }
}
