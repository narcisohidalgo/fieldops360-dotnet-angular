using FieldOps.Application.Facilities;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/facilities")]
public sealed class FacilitiesController : ControllerBase
{
    private readonly IFacilityService _facilityService;

    public FacilitiesController(IFacilityService facilityService)
    {
        _facilityService = facilityService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FacilityDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var facilities = await _facilityService.GetAllAsync(
            cancellationToken);

        return Ok(facilities);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<FacilityDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var facility = await _facilityService.GetByIdAsync(
            id, cancellationToken);

        if (facility is null)
        {
            return NotFound();
        }

        return Ok(facility);
    }

    [HttpPost]
    public async Task<ActionResult<FacilityDto>> Create(
        [FromBody] CreateFacilityCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var facility = await _facilityService.CreateAsync(
                command, cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = facility.Id },
                facility);
        }
        catch (DuplicateFacilityCodeException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Facility code already exists.",
                detail: ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid facility data.",
                detail: ex.Message);
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateFacilityCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _facilityService.UpdateAsync(
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
                title: "Invalid facility data.",
                detail: ex.Message);
        }
    }

    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var activated = await _facilityService.ActivateAsync(
            id, cancellationToken);

        if (!activated)
        {
            return NotFound();
        }

        return NoContent();
    }


    [HttpPatch("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var deactivated = await _facilityService.DeactivateAsync(
            id, cancellationToken);

        if (!deactivated)
        {
            return NotFound();
        }

        return NoContent();
    }
}
