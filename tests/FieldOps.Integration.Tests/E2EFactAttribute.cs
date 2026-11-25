namespace FieldOps.Integration.Tests;

[AttributeUsage(AttributeTargets.Method)]
public sealed class E2EFactAttribute : FactAttribute
{
    public E2EFactAttribute()
    {
        if (Environment.GetEnvironmentVariable(
            "FIELDOPS_RUN_E2E") != "1")
        {
            Skip = "Set FIELDOPS_RUN_E2E=1 to run real browser tests.";
        }
    }
}
