namespace FieldOps.Application.Technicians;

public sealed record UpdateTechnicianCommand(
    string Name,
    string Email,
    string? Phone,
    string? Specialty
);
