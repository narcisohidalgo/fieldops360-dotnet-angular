using FieldOps.Api.Security;
using Microsoft.AspNetCore.Authorization;
using FieldOps.Application.Incidents;
using FieldOps.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[Authorize(Policy = FieldOpsPolicies.ReadIncidents)]
[AutoValidateAntiforgeryToken]
[ApiController]
[Route("api/incidents")]
public sealed class IncidentsController : ControllerBase
{
    private readonly IIncidentService _incidentService;

    public IncidentsController(IIncidentService incidentService)
    {
        _incidentService = incidentService;
    }

    // GET /api/incidents
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<IncidentDto>>> GetAll(
        [FromQuery] Guid? facilityId,
        [FromQuery] Guid? assetId,
        [FromQuery] IncidentStatus? status,
        [FromQuery] IncidentPriority? priority,
        CancellationToken cancellationToken)
    {
        try
        {
            var incidents = await _incidentService.GetAllAsync(
                facilityId,
                assetId,
                status,
                priority,
                cancellationToken);

            return Ok(incidents);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid incident filters.",
                detail: ex.Message);
        }
    }

    // GET /api/incidents/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<IncidentDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var incident = await _incidentService.GetByIdAsync(
            id,
            cancellationToken);

        if (incident is null)
        {
            return NotFound();
        }

        return Ok(incident);
    }

    // POST /api/incidents
    [Authorize(Policy = FieldOpsPolicies.ManageIncidents)]
    [HttpPost]
    public async Task<ActionResult<IncidentDto>> Create(
        [FromBody] CreateIncidentCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var incident = await _incidentService.CreateAsync(
                command,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = incident.Id },
                incident);
        }
        catch (IncidentFacilityNotFoundException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Facility not found.",
                detail: ex.Message);
        }
        catch (IncidentAssetNotFoundException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Asset not found.",
                detail: ex.Message);
        }
        catch (IncidentAssetFacilityMismatchException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Asset does not belong to facility.",
                detail: ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid incident data.",
                detail: ex.Message);
        }
    }

    // PUT /api/incidents/{id}
    [Authorize(Policy = FieldOpsPolicies.ManageIncidents)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateIncidentCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _incidentService.UpdateAsync(
                id,
                command,
                cancellationToken);

            if (!updated)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid incident data.",
                detail: ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Incident cannot be updated.",
                detail: ex.Message);
        }
        catch (IncidentConcurrencyException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Incident was modified concurrently.",
                detail: ex.Message);
        }
    }

    // PATCH /api/incidents/{id}/start
    [Authorize(Policy = FieldOpsPolicies.ManageIncidents)]
    [HttpPatch("{id:guid}/start")]
    public Task<IActionResult> StartProgress(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            id,
            _incidentService.StartProgressAsync,
            cancellationToken);
    }

    // PATCH /api/incidents/{id}/resolve
    [Authorize(Policy = FieldOpsPolicies.ManageIncidents)]
    [HttpPatch("{id:guid}/resolve")]
    public Task<IActionResult> Resolve(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            id,
            _incidentService.ResolveAsync,
            cancellationToken);
    }

    // PATCH /api/incidents/{id}/close
    [Authorize(Policy = FieldOpsPolicies.ManageIncidents)]
    [HttpPatch("{id:guid}/close")]
    public Task<IActionResult> Close(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            id,
            _incidentService.CloseAsync,
            cancellationToken);
    }

    // PATCH /api/incidents/{id}/reopen
    [Authorize(Policy = FieldOpsPolicies.ManageIncidents)]
    [HttpPatch("{id:guid}/reopen")]
    public Task<IActionResult> Reopen(
        Guid id,
        CancellationToken cancellationToken)
    {
        return ChangeStatusAsync(
            id,
            _incidentService.ReopenAsync,
            cancellationToken);
    }

    private async Task<IActionResult> ChangeStatusAsync(
        Guid id,
        Func<Guid, CancellationToken, Task<bool>> operation,
        CancellationToken cancellationToken)
    {
        try
        {
            var changed = await operation(
                id,
                cancellationToken);

            if (!changed)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Invalid incident status transition.",
                detail: ex.Message);
        }
        catch (IncidentConcurrencyException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Incident was modified concurrently.",
                detail: ex.Message);
        }
    }
}
