using System.Data;
using FieldOps.Api.Controllers;
using FieldOps.Api.Security;
using FieldOps.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace FieldOps.Api.Services;

public sealed partial class UserManagementService
{
    public Task<ManagedUserDto?> UpdateAsync(
        Guid id,
        UpdateManagedUserRequest request,
        CancellationToken cancellationToken = default)
    {
        return ExecuteMutationAsync(() =>
            UpdateCoreAsync(id, request, cancellationToken));
    }

    public Task<ManagedUserDto?> SetActiveAsync(
        Guid id,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        return ExecuteMutationAsync(() =>
            SetActiveCoreAsync(id, isActive, cancellationToken));
    }

    public Task<bool> ResetPasswordAsync(
        Guid id,
        ResetManagedUserPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        return ExecuteMutationAsync(() =>
            ResetPasswordCoreAsync(id, request, cancellationToken));
    }

    private static async Task<T> ExecuteMutationAsync<T>(
        Func<Task<T>> operation)
    {
        try
        {
            return await operation();
        }
        catch (Exception ex) when (IsSqlConflict(ex))
        {
            throw new UserManagementException(
                Conflict,
                "Se ha detectado un conflicto concurrente. " +
                "Actualiza e intentalo de nuevo.");
        }
    }

    private static bool IsSqlConflict(Exception exception)
    {
        // EF Core may wrap transient SQL errors in an
        // InvalidOperationException or DbUpdateException.
        // Inspect the entire exception chain without
        // suppressing unrelated application failures.
        for (
            Exception? current = exception;
            current is not null;
            current = current.InnerException)
        {
            if (current is SqlException sql &&
                (sql.Number is 2601 or 2627 or 1205))
            {
                return true;
            }
        }

        return false;
    }

    private async Task<ManagedUserDto?> UpdateCoreAsync(
        Guid id,
        UpdateManagedUserRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var name = request.DisplayName?.Trim() ?? string.Empty;
        var role = request.Role?.Trim() ?? string.Empty;

        if (name.Length < 2 || name.Length > 150)
        {
            throw new UserManagementException(
                BadRequest,
                "El nombre debe tener entre 2 y 150 caracteres.");
        }

        if (!AllowedRoles.Contains(role) ||
            !await _roles.RoleExistsAsync(role))
        {
            throw new UserManagementException(
                BadRequest,
                "El rol seleccionado no es valido.");
        }

        // La transaccion garantiza que nombre, vinculacion,
        // rol y security stamp se actualizan juntos.
        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

        var user = await _users.FindByIdAsync(id.ToString());

        if (user is null)
        {
            return null;
        }

        var oldRoles = await _users.GetRolesAsync(user);

        if (
            user.IsActive &&
            oldRoles.Contains(FieldOpsRoles.Administrator) &&
            role != FieldOpsRoles.Administrator
        )
        {
            await EnsureAnotherActiveAdministratorAsync(
                cancellationToken);
        }

        await ValidateTechnicianLinkAsync(
            role,
            request.TechnicianId,
            user.Id,
            cancellationToken);

        user.DisplayName = name;
        user.TechnicianId = request.TechnicianId;

        EnsureSucceeded(
            await _users.UpdateAsync(user),
            "No se pudo actualizar la cuenta.");

        // Sustituir roles dentro de la misma transaccion.
        if (
            oldRoles.Count != 1 ||
            oldRoles[0] != role
        )
        {
            if (oldRoles.Count > 0)
            {
                EnsureSucceeded(
                    await _users.RemoveFromRolesAsync(
                        user, oldRoles),
                    "No se pudieron retirar los roles anteriores.");
            }

            EnsureSucceeded(
                await _users.AddToRoleAsync(user, role),
                "No se pudo asignar el nuevo rol.");
        }

        // Invalidar cookies emitidas antes del cambio.
        EnsureSucceeded(
            await _users.UpdateSecurityStampAsync(user),
            "No se pudo invalidar la sesion anterior.");

        await transaction.CommitAsync(cancellationToken);

        return await ToDtoAsync(user);
    }

    private async Task<ManagedUserDto?> SetActiveCoreAsync(
        Guid id,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

        var user = await _users.FindByIdAsync(id.ToString());

        if (user is null)
        {
            return null;
        }

        var roles = await _users.GetRolesAsync(user);

        if (roles.Count != 1 ||
            !AllowedRoles.Contains(roles[0]))
        {
            throw new UserManagementException(
                Conflict,
                "La cuenta no tiene un rol valido y unico.");
        }

        if (isActive)
        {
            await ValidateTechnicianLinkAsync(
                roles[0],
                user.TechnicianId,
                user.Id,
                cancellationToken);
        }
        else if (
            user.IsActive &&
            roles.Contains(FieldOpsRoles.Administrator)
        )
        {
            await EnsureAnotherActiveAdministratorAsync(
                cancellationToken);
        }

        if (user.IsActive != isActive)
        {
            user.IsActive = isActive;

            EnsureSucceeded(
                await _users.UpdateAsync(user),
                "No se pudo cambiar el estado de la cuenta.");

            EnsureSucceeded(
                await _users.UpdateSecurityStampAsync(user),
                "No se pudo invalidar la sesion anterior.");
        }

        await transaction.CommitAsync(cancellationToken);

        return await ToDtoAsync(user);
    }

    private async Task<bool> ResetPasswordCoreAsync(
        Guid id,
        ResetManagedUserPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var password = request.NewPassword;

        if (string.IsNullOrWhiteSpace(password) ||
            password.Length > PasswordLimits.MaxLength)
        {
            throw new UserManagementException(
                BadRequest,
                "La nueva contrasena no es valida.");
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

        var user = await _users.FindByIdAsync(id.ToString());

        if (user is null)
        {
            return false;
        }

        // Validar antes de tocar la contrasena actual.
        // Se reutiliza la politica configurada en Identity.
        foreach (var validator in _users.PasswordValidators)
        {
            var validation = await validator.ValidateAsync(
                _users,
                user,
                password);

            if (!validation.Succeeded)
            {
                throw new UserManagementException(
                    BadRequest,
                    DescribeErrors(validation));
            }
        }

        // Ambas operaciones se realizan dentro de
        // la misma transaccion SQL Server.
        // Si falla AddPasswordAsync, se revierte
        // la eliminacion del hash anterior.
        if (await _users.HasPasswordAsync(user))
        {
            EnsureSucceeded(
                await _users.RemovePasswordAsync(user),
                "No se pudo preparar el cambio de contrasena.");
        }

        EnsureSucceeded(
            await _users.AddPasswordAsync(user, password),
            "No se pudo establecer la nueva contrasena.");

        // Las operaciones de password de Identity
        // tambien actualizan el security stamp.
        await transaction.CommitAsync(cancellationToken);

        return true;
    }

    private async Task ValidateTechnicianLinkAsync(
        string role,
        Guid? technicianId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        if (role != FieldOpsRoles.Technician)
        {
            if (technicianId.HasValue)
            {
                throw new UserManagementException(
                    BadRequest,
                    "Solo Technician puede vincularse a un tecnico.");
            }

            return;
        }

        if (!technicianId.HasValue ||
            technicianId.Value == Guid.Empty)
        {
            throw new UserManagementException(
                BadRequest,
                "Selecciona un tecnico para esta cuenta.");
        }

        var technician = await _technicians.GetByIdAsync(
            technicianId.Value,
            cancellationToken);

        if (technician is null)
        {
            throw new UserManagementException(
                BadRequest,
                "El tecnico seleccionado no existe.");
        }

        if (!technician.IsActive)
        {
            throw new UserManagementException(
                Conflict,
                "El tecnico seleccionado esta inactivo.");
        }

        var linkedToAnotherUser =
            await _users.Users.AnyAsync(
                item =>
                    item.Id != userId &&
                    item.TechnicianId == technicianId,
                cancellationToken);

        if (linkedToAnotherUser)
        {
            throw new UserManagementException(
                Conflict,
                "El tecnico ya esta vinculado a otra cuenta.");
        }
    }

    private async Task EnsureAnotherActiveAdministratorAsync(
        CancellationToken cancellationToken)
    {
        // SERIALIZABLE permite comprobar la condicion
        // mientras se mantiene la transaccion.
        var activeAdministrators = await (
            from user in _db.Users
            join assignment in _db.UserRoles
                on user.Id equals assignment.UserId
            join role in _db.Roles
                on assignment.RoleId equals role.Id
            where user.IsActive &&
                  role.NormalizedName == "ADMINISTRATOR"
            select user.Id
        ).Distinct().CountAsync(cancellationToken);

        if (activeAdministrators <= 1)
        {
            throw new UserManagementException(
                Conflict,
                "No puedes desactivar o quitar el rol " +
                "al ultimo administrador activo.");
        }
    }

    private static void EnsureSucceeded(
        IdentityResult result,
        string message)
    {
        if (!result.Succeeded)
        {
            throw new UserManagementException(
                Conflict,
                message + " " + DescribeErrors(result));
        }
    }
}
