using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/system")]
public sealed class SystemController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            application = "FieldOps 360",
            status = "online",
            framework = ".NET 10",
            timestampUtc = DateTimeOffset.UtcNow
        });
    }
}
