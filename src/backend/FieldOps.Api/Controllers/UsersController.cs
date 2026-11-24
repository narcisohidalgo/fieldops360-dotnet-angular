using FieldOps.Api.Security;
using FieldOps.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

/// <summary>
/// Administracion de cuentas de FieldOps 360.
/// Accesible exclusivamente para Administrator.
/// </summary>
[ApiController]
[Route("api/users")]
[Authorize(Policy = FieldOpsPolicies.ManageUsers)]
[AutoValidateAntiforgeryToken]
public sealed class UsersController : ControllerBase
{
    private readonly IUserManagementService _users;

    public UsersController(IUserManagementService users)
    {
        _users = users;
    }

    // GET /api/users
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ManagedUserDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var users = await _users.GetAllAsync(cancellationToken);

        return Ok(users);
    }

    // GET /api/users/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ManagedUserDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var user = await _users.GetByIdAsync(
            id,
            cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        return Ok(user);
    }

    // POST /api/users
    [HttpPost]
    public async Task<ActionResult<ManagedUserDto>> Create(
        [FromBody] CreateManagedUserRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var created = await _users.CreateAsync(
                request,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = created.Id },
                created);
        }
        catch (UserManagementException ex)
        {
            return BusinessProblem(ex);
        }
    }

    // PUT /api/users/{id}
    [HttpPut("{id:guid}")]
    public Task<ActionResult<ManagedUserDto>> Update(
        Guid id,
        [FromBody] UpdateManagedUserRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteUserMutationAsync(
            () => _users.UpdateAsync(
                id,
                request,
                cancellationToken));
    }

    // PATCH /api/users/{id}/activate
    [HttpPatch("{id:guid}/activate")]
    public Task<ActionResult<ManagedUserDto>> Activate(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ExecuteUserMutationAsync(
            () => _users.SetActiveAsync(
                id,
                true,
                cancellationToken));
    }

    // PATCH /api/users/{id}/deactivate
    [HttpPatch("{id:guid}/deactivate")]
    public Task<ActionResult<ManagedUserDto>> Deactivate(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ExecuteUserMutationAsync(
            () => _users.SetActiveAsync(
                id,
                false,
                cancellationToken));
    }

    // POST /api/users/{id}/reset-password
    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(
        Guid id,
        [FromBody] ResetManagedUserPasswordRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _users.ResetPasswordAsync(
                id,
                request,
                cancellationToken);

            if (!updated)
            {
                return NotFound();
            }

            // No devolver contrasenas ni hashes.
            return NoContent();
        }
        catch (UserManagementException ex)
        {
            return BusinessProblem(ex);
        }
    }

    // Tratamiento compartido para PUT y PATCH.
    private async Task<ActionResult<ManagedUserDto>>
        ExecuteUserMutationAsync(
            Func<Task<ManagedUserDto?>> operation)
    {
        try
        {
            var user = await operation();

            if (user is null)
            {
                return NotFound();
            }

            return Ok(user);
        }
        catch (UserManagementException ex)
        {
            return BusinessProblem(ex);
        }
    }

    // Respuestas de error coherentes y sin
    // exponer detalles internos de la base de datos.
    private ObjectResult BusinessProblem(
        UserManagementException exception)
    {
        return Problem(
            statusCode: exception.StatusCode,
            title: "User management operation rejected.",
            detail: exception.Message);
    }
}
