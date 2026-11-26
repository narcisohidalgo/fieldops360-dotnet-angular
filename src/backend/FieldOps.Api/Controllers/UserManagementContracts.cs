using System.ComponentModel.DataAnnotations;
using FieldOps.Api.Security;

namespace FieldOps.Api.Controllers;

/// <summary>
/// Datos publicos de una cuenta administrada.
/// Nunca incluye contrasenas ni hashes.
/// </summary>
public sealed record ManagedUserDto(
    Guid Id,
    string Email,
    string DisplayName,
    bool IsActive,
    Guid? TechnicianId,
    IReadOnlyList<string> Roles
);

/// <summary>
/// Solicitud de creacion de una cuenta.
/// Identity validara la politica de contrasenas.
/// </summary>
public sealed class CreateManagedUserRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; init; } = string.Empty;

    [Required]
    [MinLength(2)]
    [MaxLength(150)]
    public string DisplayName { get; init; } = string.Empty;

    [Required]
    [MaxLength(PasswordLimits.MaxLength)]
    public string Password { get; init; } = string.Empty;

    [Required]
    public string Role { get; init; } = string.Empty;

    public Guid? TechnicianId { get; init; }
}

/// <summary>
/// Actualizacion de nombre, rol y vinculacion con tecnico.
/// El correo identificativo se conserva.
/// </summary>
public sealed class UpdateManagedUserRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(150)]
    public string DisplayName { get; init; } = string.Empty;

    [Required]
    public string Role { get; init; } = string.Empty;

    public Guid? TechnicianId { get; init; }
}

/// <summary>
/// Restablecimiento administrativo de contrasena.
/// Nunca se devuelve la contrasena en la respuesta.
/// </summary>
public sealed class ResetManagedUserPasswordRequest
{
    [Required]
    [MaxLength(PasswordLimits.MaxLength)]
    public string NewPassword { get; init; } = string.Empty;
}
