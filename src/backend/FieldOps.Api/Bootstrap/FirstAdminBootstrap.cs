using System.ComponentModel.DataAnnotations;
using System.Text;
using FieldOps.Api.Security;
using FieldOps.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Api.Bootstrap;

internal static class FirstAdminBootstrap
{
    private const string AdministratorRole = "Administrator";

    private static readonly string[] RoleNames =
    [
        AdministratorRole,
        "Supervisor",
        "Technician"
    ];

    public static async Task RunAsync(IServiceProvider services)
    {
        if (Console.IsInputRedirected)
        {
            throw new InvalidOperationException(
                "Bootstrap requires an interactive terminal.");
        }

        await using var scope = services.CreateAsyncScope();

        var users = scope.ServiceProvider
            .GetRequiredService<UserManager<FieldOpsUser>>();

        var roles = scope.ServiceProvider
            .GetRequiredService<RoleManager<IdentityRole<Guid>>>();

        // Este comando solo puede crear el primer administrador.
        if (await roles.RoleExistsAsync(AdministratorRole))
        {
            var existingAdmins =
                await users.GetUsersInRoleAsync(AdministratorRole);

            if (existingAdmins.Count > 0)
            {
                throw new InvalidOperationException(
                    "An administrator already exists. " +
                    "Initial bootstrap is disabled.");
            }
        }

        Console.WriteLine();
        Console.WriteLine("FIELDOPS 360 - PRIMER ADMINISTRADOR");
        Console.WriteLine("----------------------------------");

        Console.Write("Nombre visible: ");
        var displayName = (Console.ReadLine() ?? "").Trim();

        if (displayName.Length is < 1 or > 150)
        {
            throw new InvalidOperationException(
                "El nombre debe tener entre 1 y 150 caracteres.");
        }

        Console.Write("Correo electronico: ");
        var email = (Console.ReadLine() ?? "").Trim();

        if (email.Length > 256 ||
            !new EmailAddressAttribute().IsValid(email) ||
            string.IsNullOrWhiteSpace(email))
        {
            throw new InvalidOperationException(
                "El correo electronico no es valido.");
        }

        if (await users.FindByEmailAsync(email) is not null)
        {
            throw new InvalidOperationException(
                "Ya existe una cuenta con ese correo.");
        }

        Console.WriteLine();
        Console.WriteLine(
            "La contrasena no se mostrara al escribirla.");

        Console.Write("Contrasena: ");
        var password = ReadHiddenPassword();

        Console.Write("Repetir contrasena: ");
        var confirmation = ReadHiddenPassword();

        if (password != confirmation)
        {
            throw new InvalidOperationException(
                "Las contrasenas no coinciden.");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "La contrasena no puede estar vacia.");
        }

        if (password.Length > PasswordLimits.MaxLength)
        {
            throw new InvalidOperationException(
                "La contrasena supera la longitud maxima permitida.");
        }

        // Crear solo los roles que no existan.
        foreach (var roleName in RoleNames)
        {
            if (await roles.RoleExistsAsync(roleName))
            {
                continue;
            }

            var result = await roles.CreateAsync(
                new IdentityRole<Guid>(roleName));

            EnsureSuccess(result, $"Crear rol {roleName}");
        }

        var admin = new FieldOpsUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = displayName,
            IsActive = true
        };

        // Identity valida la politica de contrasenas y
        // almacena exclusivamente su hash.
        var created = await users.CreateAsync(admin, password);

        EnsureSuccess(created, "Crear administrador");

        var assigned = await users.AddToRoleAsync(
            admin, AdministratorRole);

        if (!assigned.Succeeded)
        {
            // Evitar dejar una cuenta parcialmente creada.
            var deleted = await users.DeleteAsync(admin);

            if (!deleted.Succeeded)
            {
                Console.Error.WriteLine(
                    "ATENCION: revisar la cuenta parcialmente creada.");
            }

            EnsureSuccess(assigned, "Asignar rol Administrator");
        }

        Console.WriteLine();
        Console.WriteLine("Roles creados o verificados:");
        foreach (var roleName in RoleNames)
        {
            Console.WriteLine($"  - {roleName}");
        }

        Console.WriteLine();
        Console.WriteLine("Administrador creado correctamente.");
        Console.WriteLine("Rol asignado: Administrator");
        Console.WriteLine("No se ha almacenado ninguna contrasena en codigo.");
    }

    private static string ReadHiddenPassword()
    {
        var buffer = new StringBuilder();

        while (true)
        {
            var key = Console.ReadKey(intercept: true);

            if (key.Key == ConsoleKey.Enter)
            {
                Console.WriteLine();
                break;
            }

            if (key.Key == ConsoleKey.Backspace)
            {
                if (buffer.Length > 0)
                {
                    buffer.Length--;
                }

                continue;
            }

            if (!char.IsControl(key.KeyChar))
            {
                buffer.Append(key.KeyChar);
            }
        }

        var value = buffer.ToString();
        buffer.Clear();
        return value;
    }

    private static void EnsureSuccess(
        IdentityResult result,
        string operation)
    {
        if (result.Succeeded)
        {
            return;
        }

        var errors = string.Join(
            "; ",
            result.Errors.Select(error => error.Description));

        throw new InvalidOperationException(
            $"{operation}: {errors}");
    }
}
