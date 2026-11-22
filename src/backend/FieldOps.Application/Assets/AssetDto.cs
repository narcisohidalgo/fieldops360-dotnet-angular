namespace FieldOps.Application.Assets;

public sealed record AssetDto(
    Guid Id,
    Guid FacilityId,
    string Code,
    string Name,
    string? Description,
    bool IsActive
);
