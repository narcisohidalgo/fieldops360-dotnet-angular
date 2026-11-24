namespace FieldOps.Application.Technicians;

public interface ITechnicianService
{
    Task<IReadOnlyList<TechnicianDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<TechnicianDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<TechnicianDto> CreateAsync(
        CreateTechnicianCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(
        Guid id,
        UpdateTechnicianCommand command,
        CancellationToken cancellationToken = default);

    Task<bool> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<bool> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}
