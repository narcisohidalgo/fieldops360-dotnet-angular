using Microsoft.AspNetCore.Identity;

namespace FieldOps.Infrastructure.Identity;

// Cuenta de acceso a FieldOps 360.
// No representa automaticamente a un tecnico.
public sealed class FieldOpsUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public Guid? TechnicianId { get; set; }
}
