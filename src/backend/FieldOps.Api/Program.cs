using FieldOps.Api.Security;
using FieldOps.Api.Hubs;
using FieldOps.Application.Assets;
using FieldOps.Application.Incidents;
using FieldOps.Application.Facilities;
using FieldOps.Application.Technicians;
using FieldOps.Application.WorkOrders;
using FieldOps.Application.Dashboard;
using FieldOps.Api.Bootstrap;
using FieldOps.Infrastructure;
using FieldOps.Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

var bootstrapAdmin = args.Contains(
    "--bootstrap-admin",
    StringComparer.Ordinal);

var startupArgs = args
    .Where(arg => !string.Equals(
        arg, "--bootstrap-admin", StringComparison.Ordinal))
    .ToArray();

var builder = WebApplication.CreateBuilder(startupArgs);

// Register application services.
builder.Services.AddControllersWithViews(options =>
{
    // Exigir CSRF en todos los endpoints de escritura.
    // GET, HEAD, OPTIONS y TRACE quedan exentos.
    options.Filters.Add(
        new Microsoft.AspNetCore.Mvc.AutoValidateAntiforgeryTokenAttribute());
});
builder.Services.AddOpenApi();

// SignalR: conexiones autenticadas para eventos operativos.
builder.Services.AddSignalR();
builder.Services.AddSingleton<
    IOperationsEventPublisher,
    OperationsEventPublisher>();

// Register Infrastructure and Entity Framework Core.
builder.Services.AddInfrastructure(builder.Configuration);

// Autenticacion mediante ASP.NET Core Identity.
builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

// Cookie de sesion: nunca accesible desde JavaScript.
// HTTPS obligatorio en produccion; HTTP solo en desarrollo local.
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "FieldOps.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;

    options.Cookie.SecurePolicy =
        builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;

    options.ExpireTimeSpan = TimeSpan.FromHours(2);
    options.SlidingExpiration = false;
});

builder.Services.AddFieldOpsAuthorization();

// Configurar antifalsificacion para las peticiones de escritura.
// Los controladores ya aplican su validacion global.
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = "FieldOps.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;

    options.Cookie.SecurePolicy =
        builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
});

builder.Services.AddScoped<IFacilityService, FacilityService>();
builder.Services.AddScoped<IAssetService, AssetService>();
builder.Services.AddScoped<IIncidentService, IncidentService>();
builder.Services.AddScoped<ITechnicianService, TechnicianService>();
builder.Services.AddScoped<IWorkOrderService, WorkOrderService>();
builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);

// Comprobar cambios de roles, contrasenas y estado
// en cada peticion autenticada.
// Identity invalida las cookies cuyo security stamp cambio.
builder.Services.Configure<
    Microsoft.AspNetCore.Identity.SecurityStampValidatorOptions>(
    options => options.ValidationInterval = TimeSpan.Zero);

var app = builder.Build();

// Comando administrativo exclusivamente local.
// No inicia el servidor ni expone un endpoint de bootstrap.
if (bootstrapAdmin)
{
    if (!app.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "Admin bootstrap is allowed only in Development.");
    }

    await FirstAdminBootstrap.RunAsync(app.Services);
    return;
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Endpoint SignalR. La autorizacion se define en OperationsHub.
app.MapHub<OperationsHub>(
    OperationsHub.Route,
    options => options.CloseOnAuthenticationExpiration = true);

app.Run();

public partial class Program { }
