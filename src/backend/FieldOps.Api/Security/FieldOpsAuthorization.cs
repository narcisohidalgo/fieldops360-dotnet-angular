using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Api.Security;

public static class FieldOpsRoles
{
    public const string Administrator = "Administrator";
    public const string Supervisor = "Supervisor";
    public const string Technician = "Technician";
}

public static class FieldOpsPolicies
{
    public const string ReadFacilitiesAndAssets = "Operations.ReadBasic";
    public const string ManageFacilities = "Facilities.Manage";
    public const string ManageAssets = "Assets.Manage";

    public const string ReadIncidents = "Incidents.Read";
    public const string ManageIncidents = "Incidents.Manage";

    public const string ReadTechnicians = "Technicians.Read";
    public const string ManageTechnicians = "Technicians.Manage";

    public const string ReadWorkOrders = "WorkOrders.Read";
    public const string ManageWorkOrders = "WorkOrders.Manage";

    public const string ReadDashboard = "Dashboard.Read";
    public const string ManageUsers = "Users.Manage";
}

public static class FieldOpsAuthorization
{
    public static IServiceCollection AddFieldOpsAuthorization(
        this IServiceCollection services)
    {
        services.AddAuthorization(options =>
        {
            // Denegar acceso anonimo a cualquier endpoint
            // que no tenga autorizacion explicita.
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
            options.AddPolicy(
                FieldOpsPolicies.ReadFacilitiesAndAssets,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor,
                        FieldOpsRoles.Technician));

            options.AddPolicy(
                FieldOpsPolicies.ManageFacilities,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(FieldOpsRoles.Administrator));

            options.AddPolicy(
                FieldOpsPolicies.ManageAssets,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));

            options.AddPolicy(
                FieldOpsPolicies.ReadIncidents,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));

            options.AddPolicy(
                FieldOpsPolicies.ManageIncidents,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));

            options.AddPolicy(
                FieldOpsPolicies.ReadTechnicians,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));

            options.AddPolicy(
                FieldOpsPolicies.ManageTechnicians,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));

            options.AddPolicy(
                FieldOpsPolicies.ReadWorkOrders,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));

            options.AddPolicy(
                FieldOpsPolicies.ManageWorkOrders,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));

            options.AddPolicy(
                FieldOpsPolicies.ReadDashboard,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(
                        FieldOpsRoles.Administrator,
                        FieldOpsRoles.Supervisor));
            options.AddPolicy(
                FieldOpsPolicies.ManageUsers,
                policy => policy
                    .RequireAuthenticatedUser()
                    .RequireRole(FieldOpsRoles.Administrator));
        });

        // Los endpoints de trabajo propio del Technician
        // aplican comprobaciones de propiedad del recurso.
        return services;
    }
}
