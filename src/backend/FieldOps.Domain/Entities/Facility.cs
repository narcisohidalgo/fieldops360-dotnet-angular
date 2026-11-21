namespace FieldOps.Domain.Entities;

public sealed class Facility
{
    private Facility() { } // EF Core

    public Facility(string code, string name, string city, string? address = null)
    {
        Id = Guid.NewGuid();
        Code = ValidateRequired(code, nameof(code), 30);
        UpdateDetails(name, city, address);
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string City { get; private set; } = string.Empty;
    public string? Address { get; private set; }
    public bool IsActive { get; private set; } = true;

    public ICollection<Asset> Assets { get; private set; } = new List<Asset>();

    public void UpdateDetails(string name, string city, string? address)
    {
        var validatedName = ValidateRequired(name, nameof(name), 150);
        var validatedCity = ValidateRequired(city, nameof(city), 100);

        var validatedAddress = address?.Trim();

        if (validatedAddress?.Length > 250)
        {
            throw new ArgumentException(
                "Address cannot exceed 250 characters.", nameof(address));
        }

        Name = validatedName;
        City = validatedCity;
        Address = string.IsNullOrWhiteSpace(validatedAddress)
            ? null
            : validatedAddress;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    private static string ValidateRequired(
        string value, string parameterName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(
                $"{parameterName} is required.", parameterName);
        }

        var trimmedValue = value.Trim();

        if (trimmedValue.Length > maxLength)
        {
            throw new ArgumentException(
                $"{parameterName} cannot exceed {maxLength} characters.",
                parameterName);
        }

        return trimmedValue;
    }
}
