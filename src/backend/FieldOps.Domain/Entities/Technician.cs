using System.Net.Mail;

namespace FieldOps.Domain.Entities;

public sealed class Technician
{
    private Technician() { } // EF Core

    public Technician(
        string code,
        string name,
        string email,
        string? phone = null,
        string? specialty = null)
    {
        var validCode = ValidateRequired(code, nameof(code), 30);
        var validName = ValidateRequired(name, nameof(name), 150);
        var validEmail = ValidateEmail(email);
        var validPhone = NormalizeOptional(phone, nameof(phone), 30);
        var validSpecialty = NormalizeOptional(
            specialty, nameof(specialty), 100);

        Id = Guid.NewGuid();
        Code = validCode;
        Name = validName;
        Email = validEmail;
        Phone = validPhone;
        Specialty = validSpecialty;
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public string? Specialty { get; private set; }
    public bool IsActive { get; private set; } = true;

    public void UpdateDetails(
        string name,
        string email,
        string? phone,
        string? specialty)
    {
        var validName = ValidateRequired(name, nameof(name), 150);
        var validEmail = ValidateEmail(email);
        var validPhone = NormalizeOptional(phone, nameof(phone), 30);
        var validSpecialty = NormalizeOptional(
            specialty, nameof(specialty), 100);

        Name = validName;
        Email = validEmail;
        Phone = validPhone;
        Specialty = validSpecialty;
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    private static string ValidateRequired(
        string value,
        string parameterName,
        int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(
                $"{parameterName} is required.", parameterName);
        }

        var trimmed = value.Trim();

        if (trimmed.Length > maxLength)
        {
            throw new ArgumentException(
                $"{parameterName} cannot exceed {maxLength} characters.",
                parameterName);
        }

        return trimmed;
    }

    private static string ValidateEmail(string email)
    {
        var value = ValidateRequired(email, nameof(email), 254);

        if (!MailAddress.TryCreate(value, out var parsed) ||
            !string.Equals(
                parsed.Address,
                value,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                "Email must be valid.", nameof(email));
        }

        return value;
    }

    private static string? NormalizeOptional(
        string? value,
        string parameterName,
        int maxLength)
    {
        var trimmed = value?.Trim();

        if (trimmed?.Length > maxLength)
        {
            throw new ArgumentException(
                $"{parameterName} cannot exceed {maxLength} characters.",
                parameterName);
        }

        return string.IsNullOrWhiteSpace(trimmed)
            ? null
            : trimmed;
    }
}
