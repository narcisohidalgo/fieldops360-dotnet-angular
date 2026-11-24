namespace FieldOps.Application.Technicians;

public sealed record CreateTechnicianCommand(
    string Code,
    string Name,
    string Email,
    string? Phone,
    string? Specialty
);
