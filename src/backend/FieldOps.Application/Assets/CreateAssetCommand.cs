namespace FieldOps.Application.Assets;

public sealed record CreateAssetCommand(
    Guid FacilityId,
    string Code,
    string Name,
    string? Description
);
