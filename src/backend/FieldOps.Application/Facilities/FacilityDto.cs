namespace FieldOps.Application.Facilities;

public sealed record FacilityDto(
    Guid Id,
    string Code,
    string Name,
    string City,
    string? Address,
    bool IsActive,
    decimal? Latitude = null,
    decimal? Longitude = null
);
