namespace FieldOps.Domain.Entities;

public sealed class Asset
{
    private Asset() { } // EF Core

    public Asset(
        Guid facilityId,
        string code,
        string name,
        string? description = null)
    {
        if (facilityId == Guid.Empty)
        {
            throw new ArgumentException(
                "Facility ID is required.",
                nameof(facilityId));
        }

        var validatedCode = ValidateRequired(
            code, nameof(code), 50);

        var validatedName = ValidateRequired(
            name, nameof(name), 150);

        var validatedDescription = description?.Trim();

        if (validatedDescription?.Length > 500)
        {
            throw new ArgumentException(
                "Description cannot exceed 500 characters.",
                nameof(description));
        }

        Id = Guid.NewGuid();
        FacilityId = facilityId;
        Code = validatedCode;
        Name = validatedName;
        Description = string.IsNullOrWhiteSpace(validatedDescription)
            ? null
            : validatedDescription;

        IsActive = true;
    }

    public Guid Id { get; private set; }
    public Guid FacilityId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;

    public Facility Facility { get; private set; } = null!;

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public void UpdateDetails(string name, string? description)
    {
        var validatedName = ValidateRequired(
            name, nameof(name), 150);

        var validatedDescription = description?.Trim();

        if (validatedDescription?.Length > 500)
        {
            throw new ArgumentException(
                "Description cannot exceed 500 characters.",
                nameof(description));
        }

        Name = validatedName;

        Description = string.IsNullOrWhiteSpace(validatedDescription)
            ? null
            : validatedDescription;
    }

    private static string ValidateRequired(
        string value,
        string parameterName,
        int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(
                $"{parameterName} is required.",
                parameterName);
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
