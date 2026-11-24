using FieldOps.Application.Assets;
using FieldOps.Application.Incidents;
using FieldOps.Application.Facilities;
using FieldOps.Application.Technicians;
using FieldOps.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Register application services.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register Infrastructure and Entity Framework Core.
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddScoped<IFacilityService, FacilityService>();
builder.Services.AddScoped<IAssetService, AssetService>();
builder.Services.AddScoped<IIncidentService, IncidentService>();
builder.Services.AddScoped<ITechnicianService, TechnicianService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
