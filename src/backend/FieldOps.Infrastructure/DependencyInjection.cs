using FieldOps.Application.Abstractions.Persistence;
using FieldOps.Infrastructure.Identity;
using FieldOps.Infrastructure.Persistence;
using FieldOps.Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Identity;
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

        // Identity: usuarios y roles almacenados en SQL Server.
        services.AddIdentityCore<FieldOpsUser>(options =>
        {
            options.User.RequireUniqueEmail = true;

            options.Password.RequiredLength = 12;
            options.Password.RequiredUniqueChars = 3;
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = true;

            options.Lockout.DefaultLockoutTimeSpan =
                TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
        })
        .AddRoles<IdentityRole<Guid>>()
        .AddSignInManager()
        .AddEntityFrameworkStores<FieldOpsDbContext>();
        services.AddScoped<IFacilityRepository, FacilityRepository>();
        services.AddScoped<IAssetRepository, AssetRepository>();
        services.AddScoped<IIncidentRepository, IncidentRepository>();
        services.AddScoped<ITechnicianRepository, TechnicianRepository>();
        services.AddScoped<IWorkOrderRepository, WorkOrderRepository>();

        return services;
    }
}
