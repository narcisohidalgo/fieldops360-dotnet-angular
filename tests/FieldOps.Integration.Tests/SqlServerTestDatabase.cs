using FieldOps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FieldOps.Integration.Tests;

public sealed class SqlServerTestDatabase : IAsyncDisposable
{
    private readonly string _databaseName =
        $"FieldOpsIntegrationTests_{Guid.NewGuid():N}";

    private SqlServerTestDatabase() { }

    private string BuildConnectionString(string database)
    {
        return new SqlConnectionStringBuilder
        {
            DataSource = "(local)",
            InitialCatalog = database,
            IntegratedSecurity = true,
            TrustServerCertificate = true,
            ConnectTimeout = 5,
            Pooling = false
        }.ConnectionString;
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
