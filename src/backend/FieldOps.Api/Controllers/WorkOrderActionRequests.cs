namespace FieldOps.Api.Controllers;

public sealed record AssignWorkOrderTechnicianRequest(
    Guid? TechnicianId);

public sealed record CancelWorkOrderRequest(
    string Reason);
