namespace FieldOps.Application.WorkOrders;

public enum WorkOrderReferenceError
{
    FacilityNotFound,
    AssetNotFound,
    AssetFacilityMismatch,
    IncidentNotFound,
    IncidentFacilityMismatch,
    IncidentAssetMismatch,
    TechnicianNotFound,
    TechnicianInactive
}

public sealed class WorkOrderReferenceException : Exception
{
    public WorkOrderReferenceError Error { get; }

    public WorkOrderReferenceException(
        WorkOrderReferenceError error,
        string message)
        : base(message)
    {
        Error = error;
    }
}
