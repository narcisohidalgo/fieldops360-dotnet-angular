using FieldOps.Application.Assets;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/assets")]
public sealed class AssetsController : ControllerBase
{
    private readonly IAssetService _assetService;

    public AssetsController(IAssetService assetService)
    {
        _assetService = assetService;
    }

    // GET /api/assets
    // GET /api/assets?facilityId={guid}
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AssetDto>>> GetAll(
        [FromQuery] Guid? facilityId,
        CancellationToken cancellationToken)
    {
        if (facilityId.HasValue)
        {
            if (facilityId.Value == Guid.Empty)
            {
                return BadRequest(
                    "A valid facility ID is required.");
            }

            var filteredAssets =
                await _assetService.GetByFacilityIdAsync(
                    facilityId.Value,
                    cancellationToken);

            return Ok(filteredAssets);
        }

        var assets = await _assetService.GetAllAsync(
            cancellationToken);

        return Ok(assets);
    }

    // GET /api/assets/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AssetDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var asset = await _assetService.GetByIdAsync(
            id,
            cancellationToken);

        if (asset is null)
        {
            return NotFound();
        }

        return Ok(asset);
    }

    // PUT /api/assets/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateAssetCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _assetService.UpdateAsync(
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
                title: "Invalid asset data.",
                detail: ex.Message);
        }
    }

    // PATCH /api/assets/{id}/activate
    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var activated = await _assetService.ActivateAsync(
            id,
            cancellationToken);

        if (!activated)
        {
            return NotFound();
        }

        return NoContent();
    }

    // PATCH /api/assets/{id}/deactivate
    [HttpPatch("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var deactivated = await _assetService.DeactivateAsync(
            id,
            cancellationToken);

        if (!deactivated)
        {
            return NotFound();
        }

        return NoContent();
    }

    // POST /api/assets
    [HttpPost]
    public async Task<ActionResult<AssetDto>> Create(
        [FromBody] CreateAssetCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var asset = await _assetService.CreateAsync(
                command,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = asset.Id },
                asset);
        }
        catch (AssetFacilityNotFoundException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Facility not found.",
                detail: ex.Message);
        }
        catch (DuplicateAssetCodeException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Asset code already exists.",
                detail: ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid asset data.",
                detail: ex.Message);
        }
    }
}
