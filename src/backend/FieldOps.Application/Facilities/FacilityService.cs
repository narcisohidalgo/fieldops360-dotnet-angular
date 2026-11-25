using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Domain.Entities;

namespace FieldOps.Application.Facilities;

public sealed class FacilityService : IFacilityService
{
    private readonly IFacilityRepository _repository;

    public FacilityService(IFacilityRepository repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyList<FacilityDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        var facilities = await _repository.GetAllAsync(cancellationToken);

        return facilities.Select(ToDto).ToList();
    }

    public async Task<FacilityDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var facility = await _repository.GetByIdAsync(
            id, cancellationToken);

        return facility is null ? null : ToDto(facility);
    }

    public async Task<FacilityDto> CreateAsync(
        CreateFacilityCommand command,
        CancellationToken cancellationToken = default)
    {
        var facility = new Facility(
            command.Code,
            command.Name,
            command.City,
            command.Address);

        facility.SetCoordinates(
            command.Latitude,
            command.Longitude);

        if (await _repository.ExistsByCodeAsync(
            facility.Code, cancellationToken))
        {
            throw new DuplicateFacilityCodeException(facility.Code);
        }

        await _repository.AddAsync(facility, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return ToDto(facility);
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateFacilityCommand command,
        CancellationToken cancellationToken = default)
    {
        var facility = await _repository.GetByIdAsync(
            id, cancellationToken);

        if (facility is null)
            return false;

        facility.UpdateDetailsAndCoordinates(
            command.Name,
            command.City,
            command.Address,
            command.Latitude,
            command.Longitude);

        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var facility = await _repository.GetByIdAsync(
            id, cancellationToken);

        if (facility is null)
            return false;

        facility.Activate();

        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }


    public async Task<bool> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var facility = await _repository.GetByIdAsync(
            id, cancellationToken);

        if (facility is null)
            return false;

        facility.Deactivate();

        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static FacilityDto ToDto(Facility facility)
    {
        return new FacilityDto(
            facility.Id,
            facility.Code,
            facility.Name,
            facility.City,
            facility.Address,
            facility.IsActive,
            facility.Latitude,
            facility.Longitude);
    }
}
