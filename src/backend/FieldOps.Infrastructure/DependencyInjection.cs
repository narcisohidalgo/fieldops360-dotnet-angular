using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Infrastructure.Persistence;
using FieldOps.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("FieldOpsDb");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'FieldOpsDb' is not configured.");
        }

        services.AddDbContext<FieldOpsDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddScoped<IFacilityRepository, FacilityRepository>();
        services.AddScoped<IAssetRepository, AssetRepository>();
        services.AddScoped<IIncidentRepository, IncidentRepository>();
        services.AddScoped<ITechnicianRepository, TechnicianRepository>();
        services.AddScoped<IWorkOrderRepository, WorkOrderRepository>();

        return services;
    }
}
