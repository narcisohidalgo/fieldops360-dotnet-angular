using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Assets;

public sealed class AssetService : IAssetService
{
    private readonly IAssetRepository _assetRepository;
    private readonly IFacilityRepository _facilityRepository;

    public AssetService(
        IAssetRepository assetRepository,
        IFacilityRepository facilityRepository)
    {
        _assetRepository = assetRepository;
        _facilityRepository = facilityRepository;
    }

    public async Task<IReadOnlyList<AssetDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        var assets = await _assetRepository.GetAllAsync(
            cancellationToken);

        return assets.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<AssetDto>> GetByFacilityIdAsync(
        Guid facilityId,
        CancellationToken cancellationToken = default)
    {
        var assets = await _assetRepository.GetByFacilityIdAsync(
            facilityId,
            cancellationToken);

        return assets.Select(ToDto).ToList();
    }

    public async Task<AssetDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var asset = await _assetRepository.GetByIdAsync(
            id,
            cancellationToken);

        return asset is null ? null : ToDto(asset);
    }

    public async Task<AssetDto> CreateAsync(
        CreateAssetCommand command,
        CancellationToken cancellationToken = default)
    {
        // La entidad valida los datos y normaliza los textos.
        var asset = new Asset(
            command.FacilityId,
            command.Code,
            command.Name,
            command.Description);

        // Comprobar que la instalacion existe.
        var facility = await _facilityRepository.GetByIdAsync(
            asset.FacilityId,
            cancellationToken);

        if (facility is null)
        {
            throw new AssetFacilityNotFoundException(
                asset.FacilityId);
        }

        // El codigo es unico dentro de cada instalacion.
        var exists = await _assetRepository.ExistsByCodeAsync(
            asset.FacilityId,
            asset.Code,
            cancellationToken);

        if (exists)
        {
            throw new DuplicateAssetCodeException(
                asset.FacilityId,
                asset.Code);
        }

        await _assetRepository.AddAsync(
            asset,
            cancellationToken);

        await _assetRepository.SaveChangesAsync(
            cancellationToken);

        return ToDto(asset);
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateAssetCommand command,
        CancellationToken cancellationToken = default)
    {
        var asset = await _assetRepository.GetByIdAsync(
            id,
            cancellationToken);

        if (asset is null)
        {
            return false;
        }

        asset.UpdateDetails(
            command.Name,
            command.Description);

        await _assetRepository.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    public async Task<bool> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var asset = await _assetRepository.GetByIdAsync(
            id,
            cancellationToken);

        if (asset is null)
        {
            return false;
        }

        asset.Activate();

        await _assetRepository.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    public async Task<bool> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var asset = await _assetRepository.GetByIdAsync(
            id,
            cancellationToken);

        if (asset is null)
        {
            return false;
        }

        asset.Deactivate();

        await _assetRepository.SaveChangesAsync(
            cancellationToken);

        return true;
    }

    private static AssetDto ToDto(Asset asset)
    {
        return new AssetDto(
            asset.Id,
            asset.FacilityId,
            asset.Code,
            asset.Name,
            asset.Description,
            asset.IsActive);
    }
}
