namespace FieldOps.Application.Assets;

public interface IAssetService
{
    Task<IReadOnlyList<AssetDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AssetDto>> GetByFacilityIdAsync(
        Guid facilityId,
        CancellationToken cancellationToken = default);

    Task<AssetDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<AssetDto> CreateAsync(
        CreateAssetCommand command,
        CancellationToken cancellationToken = default);
    Task<bool> UpdateAsync(
        Guid id,
        UpdateAssetCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);

}
