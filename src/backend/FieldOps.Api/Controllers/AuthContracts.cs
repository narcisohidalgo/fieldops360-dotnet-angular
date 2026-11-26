using System.ComponentModel.DataAnnotations;
using FieldOps.Api.Security;

namespace FieldOps.Api.Controllers;

public sealed class LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; init; } = string.Empty;

    [Required]
    [MaxLength(PasswordLimits.MaxLength)]
    public string Password { get; init; } = string.Empty;
}

public sealed record AuthUserResponse(
    Guid Id,
    string Email,
    string DisplayName,
    Guid? TechnicianId,
    IReadOnlyList<string> Roles);

public sealed record CsrfTokenResponse(
    string RequestToken);
