using System.ComponentModel.DataAnnotations;
using System.Data;
using FieldOps.Api.Controllers;
using FieldOps.Api.Security;
using FieldOps.Application.Technicians;
using FieldOps.Infrastructure.Identity;
using FieldOps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Api.Services;

public interface IUserManagementService
{
    Task<IReadOnlyList<ManagedUserDto>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<ManagedUserDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<ManagedUserDto> CreateAsync(
        CreateManagedUserRequest request,
        CancellationToken cancellationToken = default);

    Task<ManagedUserDto?> UpdateAsync(
        Guid id,
        UpdateManagedUserRequest request,
        CancellationToken cancellationToken = default);

    Task<ManagedUserDto?> SetActiveAsync(
        Guid id,
        bool isActive,
        CancellationToken cancellationToken = default);

    Task<bool> ResetPasswordAsync(
        Guid id,
        ResetManagedUserPasswordRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class UserManagementException : Exception
{
    public int StatusCode { get; }

    public UserManagementException(
        int statusCode,
        string message) : base(message)
    {
        StatusCode = statusCode;
    }
}

public sealed partial class UserManagementService : IUserManagementService
{
    private const int BadRequest = 400;
    private const int Conflict = 409;

    private static readonly HashSet<string> AllowedRoles =
        new(StringComparer.Ordinal)
        {
            FieldOpsRoles.Administrator,
            FieldOpsRoles.Supervisor,
            FieldOpsRoles.Technician
        };

    private readonly UserManager<FieldOpsUser> _users;
    private readonly RoleManager<IdentityRole<Guid>> _roles;
    private readonly ITechnicianService _technicians;
    private readonly FieldOpsDbContext _db;

    public UserManagementService(
        UserManager<FieldOpsUser> users,
        RoleManager<IdentityRole<Guid>> roles,
        ITechnicianService technicians,
        FieldOpsDbContext db)
    {
        _users = users;
        _roles = roles;
        _technicians = technicians;
        _db = db;
    }

    public async Task<IReadOnlyList<ManagedUserDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        var users = await _users.Users
            .AsNoTracking()
            .OrderBy(user => user.Email)
            .ToListAsync(cancellationToken);

        var result = new List<ManagedUserDto>(users.Count);

        foreach (var user in users)
        {
            cancellationToken.ThrowIfCancellationRequested();
            result.Add(await ToDtoAsync(user));
        }

        return result;
    }

    public async Task<ManagedUserDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (id == Guid.Empty)
        {
            return null;
        }

        var user = await _users.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.Id == id,
                cancellationToken);

        return user is null
            ? null
            : await ToDtoAsync(user);
    }

    public async Task<ManagedUserDto> CreateAsync(
        CreateManagedUserRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var email = request.Email?.Trim() ?? string.Empty;
        var name = request.DisplayName?.Trim() ?? string.Empty;
        var role = request.Role?.Trim() ?? string.Empty;

        if (
            email.Length > 256 ||
            string.IsNullOrWhiteSpace(email) ||
            !new EmailAddressAttribute().IsValid(email)
        )
        {
            throw new UserManagementException(
                BadRequest,
                "Introduce un correo electronico valido.");
        }

        if (name.Length < 2 || name.Length > 150)
        {
            throw new UserManagementException(
                BadRequest,
                "El nombre debe tener entre 2 y 150 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            throw new UserManagementException(
                BadRequest,
                "La contrasena es obligatoria.");
        }

        if (!AllowedRoles.Contains(role))
        {
            throw new UserManagementException(
                BadRequest,
                "El rol seleccionado no es valido.");
        }

        if (!await _roles.RoleExistsAsync(role))
        {
            throw new InvalidOperationException(
                "El rol no esta configurado en Identity.");
        }

        try
        {
            // La comprobacion y la insercion se ejecutan
            // dentro de la misma transaccion.
            await using var transaction =
                await _db.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    cancellationToken);

            if (role == FieldOpsRoles.Technician)
            {
                await ValidateTechnicianLinkAsync(
                    role,
                    request.TechnicianId,
                    Guid.Empty,
                    cancellationToken);
            }
            else if (request.TechnicianId.HasValue)
            {
                throw new UserManagementException(
                    BadRequest,
                    "Solo Technician admite vinculacion con tecnico.");
            }

            var existingUser =
                await _users.FindByEmailAsync(email);

            if (existingUser is not null)
            {
                throw new UserManagementException(
                    Conflict,
                    "Ya existe un usuario con ese correo.");
            }

            var user = new FieldOpsUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                DisplayName = name,
                IsActive = true,
                TechnicianId = request.TechnicianId
            };

            var created = await _users.CreateAsync(
                user, request.Password);

            if (!created.Succeeded)
            {
                var duplicate = created.Errors.Any(error =>
                    error.Code == "DuplicateUserName" ||
                    error.Code == "DuplicateEmail");

                throw new UserManagementException(
                    duplicate ? Conflict : BadRequest,
                    duplicate
                        ? "Ya existe una cuenta con ese correo."
                        : DescribeErrors(created));
            }

            var assigned = await _users.AddToRoleAsync(
                user, role);

            if (!assigned.Succeeded)
            {
                // Al no confirmar la transaccion,
                // se revierte tambien la creacion.
                throw new UserManagementException(
                    Conflict,
                    "No se pudo asignar el rol solicitado.");
            }

            await transaction.CommitAsync(
                cancellationToken);

            return await ToDtoAsync(user);
        }
        catch (DbUpdateException ex) when (
            ex.GetBaseException() is SqlException sql &&
            (
                sql.Number == 2601 ||
                sql.Number == 2627 ||
                sql.Number == 1205
            ))
        {
            throw new UserManagementException(
                Conflict,
                "La cuenta o el tecnico han sido modificados " +
                "por otra operacion. Actualiza e intentalo de nuevo.");
        }
        catch (SqlException ex) when (
            ex.Number == 2601 ||
            ex.Number == 2627 ||
            ex.Number == 1205
        )
        {
            throw new UserManagementException(
                Conflict,
                "Se ha detectado un conflicto concurrente. " +
                "Actualiza e intentalo de nuevo.");
        }
    }
    private async Task<ManagedUserDto> ToDtoAsync(
        FieldOpsUser user)
    {
        var roles = await _users.GetRolesAsync(user);

        return new ManagedUserDto(
            user.Id,
            user.Email ?? string.Empty,
            user.DisplayName,
            user.IsActive,
            user.TechnicianId,
            roles.ToArray());
    }

    private static string DescribeErrors(
        IdentityResult result)
    {
        return string.Join(
            " ",
            result.Errors.Select(error => error.Description));
    }
}
