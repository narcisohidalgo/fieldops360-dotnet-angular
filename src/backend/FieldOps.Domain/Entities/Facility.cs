namespace FieldOps.Domain.Entities;

public sealed class Facility
{
    private Facility() { } // EF Core

    public Facility(string code, string name, string city, string? address = null)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Facility code is required.", nameof(code));

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Facility name is required.", nameof(name));

        if (string.IsNullOrWhiteSpace(city))
            throw new ArgumentException("City is required.", nameof(city));

        Id = Guid.NewGuid();
        Code = code.Trim();
        Name = name.Trim();
        City = city.Trim();
        Address = address?.Trim();
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string City { get; private set; } = string.Empty;
    public string? Address { get; private set; }
    public bool IsActive { get; private set; } = true;

    public ICollection<Asset> Assets { get; private set; } = new List<Asset>();
}
