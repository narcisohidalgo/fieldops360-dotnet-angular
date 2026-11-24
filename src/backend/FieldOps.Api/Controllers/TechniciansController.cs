using FieldOps.Api.Security;
using Microsoft.AspNetCore.Authorization;
using FieldOps.Application.Technicians;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[Authorize(Policy = FieldOpsPolicies.ReadTechnicians)]
[AutoValidateAntiforgeryToken]
[ApiController]
[Route("api/technicians")]
public sealed class TechniciansController : ControllerBase
{
    private readonly ITechnicianService _technicianService;

    public TechniciansController(
        ITechnicianService technicianService)
    {
        _technicianService = technicianService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TechnicianDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var technicians = await _technicianService.GetAllAsync(
            cancellationToken);

        return Ok(technicians);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TechnicianDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var technician = await _technicianService.GetByIdAsync(
            id, cancellationToken);

        if (technician is null)
        {
            return NotFound();
        }

        return Ok(technician);
    }

    [Authorize(Policy = FieldOpsPolicies.ManageTechnicians)]
    [HttpPost]
    public async Task<ActionResult<TechnicianDto>> Create(
        [FromBody] CreateTechnicianCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var technician = await _technicianService.CreateAsync(
                command, cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = technician.Id },
                technician);
        }
        catch (DuplicateTechnicianCodeException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Technician code already exists.",
                detail: ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid technician data.",
                detail: ex.Message);
        }
    }

    [Authorize(Policy = FieldOpsPolicies.ManageTechnicians)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateTechnicianCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _technicianService.UpdateAsync(
                id, command, cancellationToken);

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
                title: "Invalid technician data.",
                detail: ex.Message);
        }
    }

    [Authorize(Policy = FieldOpsPolicies.ManageTechnicians)]
    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var activated = await _technicianService.ActivateAsync(
            id, cancellationToken);

        if (!activated)
        {
            return NotFound();
        }

        return NoContent();
    }

    [Authorize(Policy = FieldOpsPolicies.ManageTechnicians)]
    [HttpPatch("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var deactivated = await _technicianService.DeactivateAsync(
            id, cancellationToken);

        if (!deactivated)
        {
            return NotFound();
        }

        return NoContent();
    }
}
