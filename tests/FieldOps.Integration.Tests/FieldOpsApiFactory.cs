using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace FieldOps.Integration.Tests;

public sealed class FieldOpsApiFactory
    : WebApplicationFactory<Program>
{
    public const string TestConnectionString =
        "Server=127.0.0.1,1;" +
        "Database=FieldOpsIntegrationTests;" +
        "Integrated Security=True;" +
        "TrustServerCertificate=True;" +
        "Connect Timeout=1;";

    protected override void ConfigureWebHost(
        IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.ConfigureHostConfiguration(configuration =>
        {
            configuration.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ConnectionStrings:FieldOpsDb"] =
                        TestConnectionString,
                    ["environment"] = "Testing"
                });
        });

        return base.CreateHost(builder);
    }
}
