using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using FieldOps.Api.Security;
using FieldOps.Domain.Entities;
using Xunit.Abstractions;

namespace FieldOps.Integration.Tests;

public sealed class RealBrowserIntegrationTests(
    ITestOutputHelper output)
{
    private const int ApiPort = 5091;
    private const int FrontendPort = 4292;

    [E2EFact]
    public async Task RealBrowserSuite()
    {
        var root = Environment.GetEnvironmentVariable(
            "FIELDOPS_E2E_ROOT");

        Assert.False(string.IsNullOrWhiteSpace(root));

        var apiProject = Path.Combine(
            root!, "src", "backend", "FieldOps.Api",
            "FieldOps.Api.csproj");

        var frontend = Path.Combine(
            root!, "src", "frontend", "fieldops-web");

        Assert.True(File.Exists(apiProject));
        Assert.True(Directory.Exists(frontend));

        EnsurePortAvailable(ApiPort);
        EnsurePortAvailable(FrontendPort);

        await using var database =
            await SqlServerTestDatabase.CreateAsync();

        // Prevent connections to the regular application database.
        database.AssertIsolatedConnection(
            database.ConnectionString);

        await using var factory =
            new SqlServerApiFactory(database);

        await factory.InitializeDatabaseAsync();

        var admin = await factory.CreateUserAsync(
            FieldOpsRoles.Administrator);

        var facilityCode =
            $"E2E-{Guid.NewGuid():N}"[..16].ToUpperInvariant();

        var facility = new Facility(
            facilityCode,
            "Isolated E2E Facility",
            "Cordoba");

        var technician = new Technician(
            "E2E-TEC-001",
            "E2E Technician",
            "technician@example.invalid");

        var otherTechnician = new Technician(
            "E2E-TEC-002",
            "Other Technician",
            "other@example.invalid");

        var ownOrder = new WorkOrder(
            facility.Id,
            "E2E-WO-001",
            "Assigned maintenance",
            null,
            FieldOps.Domain.Enums.WorkOrderPriority.High,
            technicianId: technician.Id);

        var foreignOrder = new WorkOrder(
            facility.Id,
            "E2E-WO-002",
            "Other technician maintenance",
            null,
            FieldOps.Domain.Enums.WorkOrderPriority.Medium,
            technicianId: otherTechnician.Id);

        await using (var db = database.CreateContext())
        {
            db.Facilities.Add(facility);

            db.Technicians.AddRange(
                technician, otherTechnician);

            db.WorkOrders.AddRange(
                ownOrder, foreignOrder);

            await db.SaveChangesAsync();
        }

        var technicianUser = await factory.CreateUserAsync(
            FieldOpsRoles.Technician, technician.Id);

        var apiInfo = new ProcessStartInfo
        {
            FileName = "dotnet",
            WorkingDirectory = Path.GetDirectoryName(apiProject)!,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        var configuration = Attribute.GetCustomAttribute(
            typeof(RealBrowserIntegrationTests).Assembly,
            typeof(System.Reflection.AssemblyConfigurationAttribute))
            as System.Reflection.AssemblyConfigurationAttribute
            ?? throw new InvalidOperationException(
                "Could not determine the test build configuration.");

        output.WriteLine(
            $"Starting isolated API in {configuration.Configuration} configuration.");

        foreach (var argument in new[]
        {
            "run",
            "--configuration",
            configuration.Configuration,
            "--no-build",
            "--no-launch-profile",
            "--project",
            apiProject,
            "--",
            "--urls",
            $"http://127.0.0.1:{ApiPort}"
        })
        {
            apiInfo.ArgumentList.Add(argument);
        }

        apiInfo.Environment["ASPNETCORE_ENVIRONMENT"] =
            "Development";

        apiInfo.Environment["DOTNET_ENVIRONMENT"] =
            "Development";

        apiInfo.Environment["ConnectionStrings__FieldOpsDb"] =
            database.ConnectionString;

        apiInfo.Environment["Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command"] =
            "Warning";

        apiInfo.Environment.Remove("ASPNETCORE_HTTPS_PORT");
        apiInfo.Environment.Remove("HTTPS_PORT");

        using var api = Process.Start(apiInfo)
            ?? throw new InvalidOperationException(
                "Could not start isolated API.");

        var apiOutput = api.StandardOutput.ReadToEndAsync();
        var apiErrors = api.StandardError.ReadToEndAsync();

        try
        {
            await WaitForApiAsync(api);

            var browserInfo = new ProcessStartInfo
            {
                FileName = OperatingSystem.IsWindows()
                    ? "cmd.exe"
                    : "npm",

                WorkingDirectory = frontend,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            if (OperatingSystem.IsWindows())
            {
                browserInfo.ArgumentList.Add("/d");
                browserInfo.ArgumentList.Add("/c");
                browserInfo.ArgumentList.Add("npm.cmd");
            }

            browserInfo.ArgumentList.Add("run");
            browserInfo.ArgumentList.Add("e2e:real");

            browserInfo.Environment["FIELDOPS_E2E_ADMIN_EMAIL"] =
                admin.Email;

            browserInfo.Environment["FIELDOPS_E2E_ADMIN_PASSWORD"] =
                admin.Password;

            browserInfo.Environment["FIELDOPS_E2E_FACILITY_CODE"] =
                facilityCode;

            browserInfo.Environment["FIELDOPS_E2E_TECHNICIAN_EMAIL"] =
                technicianUser.Email;

            browserInfo.Environment["FIELDOPS_E2E_TECHNICIAN_PASSWORD"] =
                technicianUser.Password;

            browserInfo.Environment["FIELDOPS_E2E_OWN_ORDER_ID"] =
                ownOrder.Id.ToString();

            browserInfo.Environment["FIELDOPS_E2E_FOREIGN_ORDER_ID"] =
                foreignOrder.Id.ToString();

            using var browser = Process.Start(browserInfo)
                ?? throw new InvalidOperationException(
                    "Could not start Playwright.");

            var browserOutput =
                browser.StandardOutput.ReadToEndAsync();

            var browserErrors =
                browser.StandardError.ReadToEndAsync();

            try
            {
                using var timeout = new CancellationTokenSource(
                    TimeSpan.FromMinutes(4));

                await browser.WaitForExitAsync(timeout.Token);

                var stdout = await browserOutput;
                var stderr = await browserErrors;

                output.WriteLine(stdout);
                output.WriteLine(stderr);

                Assert.True(
                    browser.ExitCode == 0,
                    $"Playwright exited with code {browser.ExitCode}." +
                    Environment.NewLine + stdout +
                    Environment.NewLine + stderr);
            }
            finally
            {
                await StopProcessAsync(browser);
            }
        }
        finally
        {
            // Detener primero los procesos y sus descendientes,
            // antes de eliminar la base de datos temporal.
            await StopProcessAsync(api);

            output.WriteLine(await apiOutput);
            output.WriteLine(await apiErrors);
        }
    }

    private static void EnsurePortAvailable(int port)
    {
        var listener = new TcpListener(IPAddress.Loopback, port);

        try
        {
            listener.Start();
        }
        catch (SocketException ex)
        {
            throw new InvalidOperationException(
                $"E2E port {port} is already in use.", ex);
        }
        finally
        {
            listener.Stop();
        }
    }

    private static async Task WaitForApiAsync(Process api)
    {
        using var handler = new HttpClientHandler
        {
            AllowAutoRedirect = false
        };

        using var client = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(2)
        };

        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(45));

        while (!timeout.IsCancellationRequested)
        {
            if (api.HasExited)
            {
                throw new InvalidOperationException(
                    $"API exited with code {api.ExitCode}.");
            }

            try
            {
                using var response = await client.GetAsync(
                    $"http://127.0.0.1:{ApiPort}/api/auth/csrf",
                    timeout.Token);

                if (response.StatusCode == HttpStatusCode.OK)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
                // El servidor todavia no esta disponible.
            }
            catch (OperationCanceledException)
                when (!timeout.IsCancellationRequested)
            {
                // Tiempo de espera de una peticion individual.
            }

            await Task.Delay(300, timeout.Token);
        }

        throw new TimeoutException(
            "The isolated API did not become ready.");
    }

    private static async Task StopProcessAsync(Process process)
    {
        if (!process.HasExited)
        {
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (InvalidOperationException)
                when (process.HasExited)
            {
                // El proceso termino durante la limpieza.
            }
        }

        await process.WaitForExitAsync();
    }
}
