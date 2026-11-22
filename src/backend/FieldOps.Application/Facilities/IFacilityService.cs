namespace FieldOps.Application.Facilities;

public interface IFacilityService
{
    Task<IReadOnlyList<FacilityDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<FacilityDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<FacilityDto> CreateAsync(
        CreateFacilityCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(
        Guid id,
        UpdateFacilityCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);


    Task<bool> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}
