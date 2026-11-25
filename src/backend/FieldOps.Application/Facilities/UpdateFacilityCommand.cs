namespace FieldOps.Application.Facilities;

public sealed record UpdateFacilityCommand(
    string Name,
    string City,
    string? Address,
    decimal? Latitude = null,
    decimal? Longitude = null
);
