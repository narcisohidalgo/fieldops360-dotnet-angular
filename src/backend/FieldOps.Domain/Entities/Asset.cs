namespace FieldOps.Domain.Entities;

public sealed class Asset
{
    private Asset() { } // EF Core

    public Asset(Guid facilityId, string code, string name, string? description = null)
    {
        if (facilityId == Guid.Empty)
            throw new ArgumentException("Facility ID is required.", nameof(facilityId));

        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Asset code is required.", nameof(code));

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Asset name is required.", nameof(name));

        Id = Guid.NewGuid();
        FacilityId = facilityId;
        Code = code.Trim();
        Name = name.Trim();
        Description = description?.Trim();
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public Guid FacilityId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;

    public Facility Facility { get; private set; } = null!;
}
