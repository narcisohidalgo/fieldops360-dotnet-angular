namespace FieldOps.Application.Assets;

public sealed record UpdateAssetCommand(
    string Name,
    string? Description
);
