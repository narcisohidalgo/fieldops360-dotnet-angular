using FieldOps.Api.Security;
using FieldOps.Application.Technicians;
using FieldOps.Application.WorkOrders;
using FieldOps.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

/// <summary>
/// Operaciones disponibles exclusivamente sobre las ordenes
/// asignadas al tecnico vinculado al usuario autenticado.
/// </summary>
[ApiController]
[Route("api/my/work-orders")]
[Authorize(Roles = FieldOpsRoles.Technician)]
[AutoValidateAntiforgeryToken]
public sealed class MyWorkOrdersController : ControllerBase
{
    private readonly UserManager<FieldOpsUser> _users;
    private readonly ITechnicianService _technicians;
    private readonly IWorkOrderService _orders;

    public MyWorkOrdersController(
        UserManager<FieldOpsUser> users,
        ITechnicianService technicians,
        IWorkOrderService orders)
    {
        _users = users;
        _technicians = technicians;
        _orders = orders;
    }

    // GET /api/my/work-orders
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkOrderDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var technicianId = await GetActiveTechnicianIdAsync(
            cancellationToken);

        if (!technicianId.HasValue)
        {
            return Forbid();
        }

        // El filtro procede de la identidad autenticada,
        // nunca de parametros enviados por el cliente.
        var orders = await _orders.GetAllAsync(
            technicianId: technicianId.Value,
            cancellationToken: cancellationToken);

        return Ok(orders);
    }

    // GET /api/my/work-orders/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkOrderDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var technicianId = await GetActiveTechnicianIdAsync(
            cancellationToken);

        if (!technicianId.HasValue)
        {
            return Forbid();
        }

        var order = await _orders.GetByIdAsync(
            id, cancellationToken);

        if (order is null ||
            order.TechnicianId != technicianId.Value)
        {
            // No revelar si una orden ajena existe.
            return NotFound();
        }

        return Ok(order);
    }

    // PATCH /api/my/work-orders/{id}/start
    [HttpPatch("{id:guid}/start")]
    public Task<IActionResult> Start(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            id,
            _orders.StartAsync,
            cancellationToken);
    }

    // PATCH /api/my/work-orders/{id}/complete
    [HttpPatch("{id:guid}/complete")]
    public Task<IActionResult> Complete(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            id,
            _orders.CompleteAsync,
            cancellationToken);
    }

    private async Task<IActionResult> ChangeStatusAsync(
        Guid id,
        Func<Guid, CancellationToken, Task<bool>> operation,
        CancellationToken cancellationToken)
    {
        var technicianId = await GetActiveTechnicianIdAsync(
            cancellationToken);

        if (!technicianId.HasValue)
        {
            return Forbid();
        }

        // La comprobacion de asignacion precede
        // siempre a cualquier cambio de estado.
        var order = await _orders.GetByIdAsync(
            id, cancellationToken);

        if (order is null ||
            order.TechnicianId != technicianId.Value)
        {
            return NotFound();
        }

        try
        {
            var changed = await operation(
                id, cancellationToken);

            return changed ? NoContent() : NotFound();
        }
        catch (WorkOrderConcurrencyException)
        {
            // RowVersion impide confirmar cambios sobre
            // una orden modificada concurrentemente.
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Work order was modified concurrently.");
        }
        catch (WorkOrderReferenceException)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Assigned technician is not eligible.");
        }
        catch (InvalidOperationException)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Invalid work order status transition.");
        }
    }

    private async Task<Guid?> GetActiveTechnicianIdAsync(
        CancellationToken cancellationToken)
    {
        // Obtener siempre el usuario desde Identity.
        var user = await _users.GetUserAsync(User);

        if (user is null ||
            !user.IsActive ||
            !user.TechnicianId.HasValue ||
            user.TechnicianId.Value == Guid.Empty)
        {
            return null;
        }

        var technician = await _technicians.GetByIdAsync(
            user.TechnicianId.Value,
            cancellationToken);

        if (technician is null || !technician.IsActive)
        {
            return null;
        }

        return technician.Id;
    }
}
