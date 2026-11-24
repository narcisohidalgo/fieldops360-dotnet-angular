using FieldOps.Infrastructure.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FieldOps.Api.Controllers;

[ApiController]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController : ControllerBase
{
    private readonly UserManager<FieldOpsUser> _users;
    private readonly SignInManager<FieldOpsUser> _signIn;
    private readonly IAntiforgery _antiforgery;

    public AuthController(
        UserManager<FieldOpsUser> users,
        SignInManager<FieldOpsUser> signIn,
        IAntiforgery antiforgery)
    {
        _users = users;
        _signIn = signIn;
        _antiforgery = antiforgery;
    }

    // GET /api/auth/csrf
    // Debe solicitarse antes de login y renovarse tras login.
    [HttpGet("csrf")]
    [AllowAnonymous]
    public ActionResult<CsrfTokenResponse> GetCsrf()
    {
        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);

        if (string.IsNullOrEmpty(tokens.RequestToken))
        {
            return Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Antiforgery token could not be generated.");
        }

        return Ok(new CsrfTokenResponse(tokens.RequestToken));
    }

    // POST /api/auth/login
    // Requiere X-XSRF-TOKEN y la cookie antifalsificacion.
    [HttpPost("login")]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<ActionResult<AuthUserResponse>> Login(
        [FromBody] LoginRequest request)
    {
        var email = request.Email.Trim();

        var user = await _users.FindByEmailAsync(email);

        // No revelar si una cuenta existe o esta desactivada.
        if (user is null || !user.IsActive)
        {
            return InvalidCredentials();
        }

        var result = await _signIn.PasswordSignInAsync(
            user,
            request.Password,
            isPersistent: false,
            lockoutOnFailure: true);

        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        return Ok(await CreateUserResponseAsync(user));
    }

    // GET /api/auth/me
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthUserResponse>> Me()
    {
        var user = await _users.GetUserAsync(User);

        if (user is null || !user.IsActive)
        {
            return Unauthorized();
        }

        return Ok(await CreateUserResponseAsync(user));
    }

    // POST /api/auth/logout
    [HttpPost("logout")]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await _signIn.SignOutAsync();
        return NoContent();
    }

    private async Task<AuthUserResponse> CreateUserResponseAsync(
        FieldOpsUser user)
    {
        var roles = await _users.GetRolesAsync(user);

        return new AuthUserResponse(
            user.Id,
            user.Email ?? string.Empty,
            user.DisplayName,
            user.TechnicianId,
            roles.OrderBy(role => role, StringComparer.Ordinal)
                .ToArray());
    }

    private ObjectResult InvalidCredentials()
    {
        return Unauthorized(new ProblemDetails
        {
            Status = StatusCodes.Status401Unauthorized,
            Title = "Invalid credentials."
        });
    }
}
