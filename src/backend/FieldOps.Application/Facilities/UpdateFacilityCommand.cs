namespace FieldOps.Application.Facilities;

public sealed record UpdateFacilityCommand(
    string Name,
    string City,
    string? Address
);
