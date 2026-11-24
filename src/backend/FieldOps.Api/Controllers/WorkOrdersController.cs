using FieldOps.Api.Security;
using Microsoft.AspNetCore.Authorization;
using FieldOps.Application.WorkOrders;
using FieldOps.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[Authorize(Policy = FieldOpsPolicies.ReadWorkOrders)]
[AutoValidateAntiforgeryToken]
[ApiController]
[Route("api/work-orders")]
public sealed class WorkOrdersController : ControllerBase
{
    private readonly IWorkOrderService _service;

    public WorkOrdersController(IWorkOrderService service)
    {
        _service = service;
    }

    // GET /api/work-orders
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkOrderDto>>> GetAll(
        [FromQuery] Guid? facilityId,
        [FromQuery] Guid? assetId,
        [FromQuery] Guid? incidentId,
        [FromQuery] Guid? technicianId,
        [FromQuery] WorkOrderStatus? status,
        [FromQuery] WorkOrderPriority? priority,
        CancellationToken cancellationToken)
    {
        try
        {
            var orders = await _service.GetAllAsync(
                facilityId,
                assetId,
                incidentId,
                technicianId,
                status,
                priority,
                cancellationToken);

            return Ok(orders);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid work order filters.",
                detail: ex.Message);
        }
    }

    // GET /api/work-orders/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkOrderDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var order = await _service.GetByIdAsync(
            id, cancellationToken);

        if (order is null)
        {
            return NotFound();
        }

        return Ok(order);
    }

    // POST /api/work-orders
    [Authorize(Policy = FieldOpsPolicies.ManageWorkOrders)]
    [HttpPost]
    public async Task<ActionResult<WorkOrderDto>> Create(
        [FromBody] CreateWorkOrderCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var order = await _service.CreateAsync(
                command, cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = order.Id },
                order);
        }
        catch (DuplicateWorkOrderCodeException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Work order code already exists.",
                detail: ex.Message);
        }
        catch (WorkOrderReferenceException ex)
        {
            return ReferenceProblem(ex);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid work order data.",
                detail: ex.Message);
        }
        catch (WorkOrderConcurrencyException ex)
        {
            return ConcurrencyProblem(ex);
        }
    }

    // PUT /api/work-orders/{id}
    [Authorize(Policy = FieldOpsPolicies.ManageWorkOrders)]
    [HttpPut("{id:guid}")]
    public Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateWorkOrderCommand command,
        CancellationToken cancellationToken)
    {
        return ExecuteMutationAsync(
            () => _service.UpdateAsync(
                id, command, cancellationToken));
    }

    // PATCH /api/work-orders/{id}/assign-technician
    // Body: { "technicianId": "guid" }
    // Body: { "technicianId": null } to unassign.
    [Authorize(Policy = FieldOpsPolicies.ManageWorkOrders)]
    [HttpPatch("{id:guid}/assign-technician")]
    public Task<IActionResult> AssignTechnician(
        Guid id,
        [FromBody] AssignWorkOrderTechnicianRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteMutationAsync(
            () => _service.AssignTechnicianAsync(
                id,
                request.TechnicianId,
                cancellationToken));
    }

    // PATCH /api/work-orders/{id}/start
    [Authorize(Policy = FieldOpsPolicies.ManageWorkOrders)]
    [HttpPatch("{id:guid}/start")]
    public Task<IActionResult> Start(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ExecuteMutationAsync(
            () => _service.StartAsync(id, cancellationToken));
    }

    // PATCH /api/work-orders/{id}/complete
    [Authorize(Policy = FieldOpsPolicies.ManageWorkOrders)]
    [HttpPatch("{id:guid}/complete")]
    public Task<IActionResult> Complete(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ExecuteMutationAsync(
            () => _service.CompleteAsync(
                id, cancellationToken));
    }

    // PATCH /api/work-orders/{id}/cancel
    // Body: { "reason": "Cancellation reason" }
    [Authorize(Policy = FieldOpsPolicies.ManageWorkOrders)]
    [HttpPatch("{id:guid}/cancel")]
    public Task<IActionResult> Cancel(
        Guid id,
        [FromBody] CancelWorkOrderRequest request,
        CancellationToken cancellationToken)
    {
        return ExecuteMutationAsync(
            () => _service.CancelAsync(
                id,
                request.Reason,
                cancellationToken));
    }

    // Shared handling for PUT/PATCH operations.
    private async Task<IActionResult> ExecuteMutationAsync(
        Func<Task<bool>> operation)
    {
        try
        {
            var changed = await operation();

            if (!changed)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (WorkOrderReferenceException ex)
        {
            return ReferenceProblem(ex);
        }
        catch (WorkOrderConcurrencyException ex)
        {
            return ConcurrencyProblem(ex);
        }
        catch (InvalidOperationException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Invalid work order operation.",
                detail: ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid work order data.",
                detail: ex.Message);
        }
    }

    private ObjectResult ReferenceProblem(
        WorkOrderReferenceException ex)
    {
        var statusCode = ex.Error switch
        {
            WorkOrderReferenceError.FacilityNotFound
                or WorkOrderReferenceError.AssetNotFound
                or WorkOrderReferenceError.IncidentNotFound
                or WorkOrderReferenceError.TechnicianNotFound
                => StatusCodes.Status404NotFound,

            WorkOrderReferenceError.TechnicianInactive
                => StatusCodes.Status409Conflict,

            _ => StatusCodes.Status400BadRequest
        };

        var title = statusCode switch
        {
            StatusCodes.Status404NotFound
                => "Referenced resource not found.",

            StatusCodes.Status409Conflict
                => "Technician is inactive.",

            _ => "Invalid work order relationship."
        };

        return Problem(
            statusCode: statusCode,
            title: title,
            detail: ex.Message);
    }

    private ObjectResult ConcurrencyProblem(
        WorkOrderConcurrencyException ex)
    {
        return Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Work order was modified concurrently.",
            detail: ex.Message);
    }
}
