namespace FieldOps.Application.Technicians;

public sealed record TechnicianDto(
    Guid Id,
    string Code,
    string Name,
    string Email,
    string? Phone,
    string? Specialty,
    bool IsActive
);
