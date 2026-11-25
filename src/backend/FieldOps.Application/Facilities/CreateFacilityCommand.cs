namespace FieldOps.Application.Facilities;

public sealed record CreateFacilityCommand(
    string Code,
    string Name,
    string City,
    string? Address,
    decimal? Latitude = null,
    decimal? Longitude = null
);
