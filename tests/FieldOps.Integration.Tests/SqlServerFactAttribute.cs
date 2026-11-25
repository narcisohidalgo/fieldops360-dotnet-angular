namespace FieldOps.Integration.Tests;

public sealed class SqlServerFactAttribute : FactAttribute
{
    public SqlServerFactAttribute()
    {
        if (Environment.GetEnvironmentVariable(
            "FIELDOPS_RUN_SQL_TESTS") != "1")
        {
            Skip = "SQL Server integration tests require explicit activation.";
        }
    }
}
