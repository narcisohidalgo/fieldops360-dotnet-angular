using FieldOps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class SqlServerTestDatabase : IAsyncDisposable
{
    private readonly string _databaseName =
        $"FieldOpsIntegrationTests_{Guid.NewGuid():N}";

    private readonly string? _testPassword;

    private SqlServerTestDatabase()
    {
        _testPassword = Environment.GetEnvironmentVariable(
            "FIELDOPS_TEST_SQL_PASSWORD");

        if (_testPassword is not null &&
            string.IsNullOrWhiteSpace(_testPassword))
        {
            throw new InvalidOperationException(
                "The isolated SQL Server password is empty.");
        }

        if (_testPassword is null && !OperatingSystem.IsWindows())
        {
            throw new InvalidOperationException(
                "Linux SQL tests require FIELDOPS_TEST_SQL_PASSWORD.");
        }
    }

    private string BuildConnectionString(string database)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = _testPassword is null
                ? "(local)"
                : "127.0.0.1,15433",
            InitialCatalog = database,
            IntegratedSecurity = _testPassword is null,
            TrustServerCertificate = true,
            ConnectTimeout = _testPassword is null ? 5 : 15,
            ApplicationName = "FieldOps.Integration.Tests",
            Pooling = false
        };

        if (_testPassword is not null)
        {
            builder.UserID = "sa";
            builder.Password = _testPassword;
        }

        return builder.ConnectionString;
    }

    internal void AssertIsolatedConnection(string? connectionString)
    {
        var actual = new SqlConnectionStringBuilder(
            connectionString ?? throw new InvalidOperationException(
                "Missing test database connection string."));

        var expected = new SqlConnectionStringBuilder(
            ConnectionString);

        Assert.Equal(_databaseName, actual.InitialCatalog);

        Assert.StartsWith(
            "FieldOpsIntegrationTests_", actual.InitialCatalog);

        // Compare the complete connection configuration without
        // exposing passwords in assertion failure messages.
        Assert.True(
            expected.EquivalentTo(actual),
            "Unexpected isolated SQL Server connection configuration.");

        Assert.True(string.IsNullOrEmpty(actual.AttachDBFilename));
        Assert.True(string.IsNullOrEmpty(actual.FailoverPartner));
    }

    public string ConnectionString =>
        BuildConnectionString(_databaseName);

    public static async Task<SqlServerTestDatabase> CreateAsync()
    {
        var database = new SqlServerTestDatabase();

        await using var connection = new SqlConnection(
            database.BuildConnectionString("master"));

        await connection.OpenAsync();

        await using var command = connection.CreateCommand();

        command.CommandText =
            $"CREATE DATABASE [{database._databaseName}]";

        await command.ExecuteNonQueryAsync();

        return database;
    }

    public FieldOpsDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<FieldOpsDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;

        return new FieldOpsDbContext(options);
    }

    public async ValueTask DisposeAsync()
    {
        await using var connection = new SqlConnection(
            BuildConnectionString("master"));

        await connection.OpenAsync();

        await using var command = connection.CreateCommand();

        command.CommandText =
            $"DROP DATABASE [{_databaseName}]";

        await command.ExecuteNonQueryAsync();
    }
}
