using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Technicians;

public sealed class TechnicianService : ITechnicianService
{
    private readonly ITechnicianRepository _repository;

    public TechnicianService(ITechnicianRepository repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyList<TechnicianDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        var technicians = await _repository.GetAllAsync(
            cancellationToken);

        return technicians.Select(ToDto).ToList();
    }

    public async Task<TechnicianDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var technician = await _repository.GetByIdAsync(
            id, cancellationToken);

        return technician is null ? null : ToDto(technician);
    }

    public async Task<TechnicianDto> CreateAsync(
        CreateTechnicianCommand command,
        CancellationToken cancellationToken = default)
    {
        var technician = new Technician(
            command.Code,
            command.Name,
            command.Email,
            command.Phone,
            command.Specialty);

        if (await _repository.ExistsByCodeAsync(
            technician.Code, cancellationToken))
        {
            throw new DuplicateTechnicianCodeException(
                technician.Code);
        }

        await _repository.AddAsync(
            technician, cancellationToken);

        await _repository.SaveChangesAsync(cancellationToken);

        return ToDto(technician);
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateTechnicianCommand command,
        CancellationToken cancellationToken = default)
    {
        var technician = await _repository.GetByIdAsync(
            id, cancellationToken);

        if (technician is null)
        {
            return false;
        }

        technician.UpdateDetails(
            command.Name,
            command.Email,
            command.Phone,
            command.Specialty);

        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var technician = await _repository.GetByIdAsync(
            id, cancellationToken);

        if (technician is null)
        {
            return false;
        }

        technician.Activate();

        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var technician = await _repository.GetByIdAsync(
            id, cancellationToken);

        if (technician is null)
        {
            return false;
        }

        technician.Deactivate();

        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static TechnicianDto ToDto(Technician technician)
    {
        return new TechnicianDto(
            technician.Id,
            technician.Code,
            technician.Name,
            technician.Email,
            technician.Phone,
            technician.Specialty,
            technician.IsActive);
    }
}
