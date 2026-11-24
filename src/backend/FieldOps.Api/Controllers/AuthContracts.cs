using System.ComponentModel.DataAnnotations;

namespace FieldOps.Api.Controllers;

public sealed class LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; init; } = string.Empty;

    [Required]
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
