"""Provision an ephemeral administrator in the GitHub-hosted Docker CI job."""
import errno
import os
from pathlib import Path
import pty
import secrets
import select
import subprocess
import termios
import time

EMAIL = "docker-admin@fieldops.example"
NAME = "Docker CI Administrator"


def run_interactive(command, password, timeout=180):
    prompts = [
        (b"Nombre visible: ", NAME),
        (b"Correo electronico: ", EMAIL),
        (b"Contrasena: ", password),
        (b"Repetir contrasena: ", password),
    ]
    success = b"Administrador creado correctamente."
    master, slave = pty.openpty()
    process = None

    try:
        settings = termios.tcgetattr(slave)
        settings[3] &= ~termios.ECHO
        termios.tcsetattr(slave, termios.TCSANOW, settings)

        process = subprocess.Popen(
            command,
            stdin=slave,
            stdout=slave,
            stderr=slave,
        )
    finally:
        os.close(slave)

        if process is None:
            os.close(master)

    deadline = time.monotonic() + timeout
    pending = b""
    step = 0
    confirmed = False

    try:
        while True:
            remaining = deadline - time.monotonic()

            if remaining <= 0:
                raise RuntimeError(
                    f"Bootstrap timed out at step {step}."
                )

            ready, _, _ = select.select(
                [master], [], [], remaining
            )

            if not ready:
                raise RuntimeError(
                    f"Bootstrap timed out at step {step}."
                )

            try:
                data = os.read(master, 4096)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise

                break

            if not data:
                break

            pending += data

            while (
                step < len(prompts)
                and prompts[step][0] in pending
            ):
                prompt, value = prompts[step]

                pending = pending.split(prompt, 1)[1]

                answer = (value + "\r").encode("utf-8")

                if os.write(master, answer) != len(answer):
                    raise RuntimeError(
                        "Incomplete terminal write."
                    )

                step += 1

            if step == len(prompts) and success in pending:
                confirmed = True

            # Never print or persist the interactive transcript.
            pending = pending[-65536:]

        code = process.wait(
            timeout=max(0.1, deadline - time.monotonic())
        )

        if (
            code != 0
            or step != len(prompts)
            or not confirmed
        ):
            raise RuntimeError(
                f"Bootstrap failed "
                f"(exit={code}, completed steps={step})."
            )
    finally:
        os.close(master)

        if process.poll() is None:
            process.kill()
            process.wait()


def sql_scalar(query):
    result = subprocess.run(
        [
            "docker", "compose", "exec", "-T", "sqlserver",
            "sh", "-c",
            'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; '
            "exec /opt/mssql-tools18/bin/sqlcmd "
            "-S localhost -U sa -C -b "
            '-d FieldOpsDockerDb -h -1 -W -Q "$1"',
            "sh",
            "SET NOCOUNT ON; " + query,
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=True,
    )

    return result.stdout.strip()


def main():
    root = Path(__file__).resolve().parents[2]

    # This helper must never provision a developer's local database.
    if (
        os.environ.get("GITHUB_ACTIONS") != "true"
        or os.environ.get("RUNNER_OS") != "Linux"
        or os.environ.get("RUNNER_ENVIRONMENT") != "github-hosted"
        or Path(
            os.environ.get("GITHUB_WORKSPACE", "/")
        ).resolve() != root
        or Path.cwd().resolve() != root
    ):
        raise RuntimeError(
            "Bootstrap is restricted to the "
            "GitHub-hosted Docker CI workspace."
        )

    env_file = Path(
        os.environ["GITHUB_ENV"]
    ).resolve(strict=True)

    runner_temp = Path(
        os.environ["RUNNER_TEMP"]
    ).resolve(strict=True)

    if (
        not env_file.is_file()
        or not env_file.is_relative_to(runner_temp)
    ):
        raise RuntimeError(
            "Unexpected GitHub environment file."
        )

    if (
        not (root / ".env").is_file()
        or not (
            root / ".fieldops-local/tls/localhost.crt"
        ).is_file()
    ):
        raise RuntimeError(
            "The isolated Docker environment "
            "has not been initialized."
        )

    if sql_scalar(
        "SELECT COUNT(*) FROM dbo.AspNetUsers;"
    ) != "0":
        raise RuntimeError(
            "Expected a fresh database with no Identity users."
        )

    # Generate a new password for every isolated CI execution.
    password = "Aa1!" + secrets.token_hex(24)

    # Register masking before the password can enter CI diagnostics.
    print(f"::add-mask::{password}", flush=True)

    container = "fieldops-ci-bootstrap-" + secrets.token_hex(8)

    command = [
        "docker", "compose", "run",
        "--rm",
        "--no-deps",
        "--pull", "never",
        "--name", container,
        "-e", "ASPNETCORE_ENVIRONMENT=Development",
        "-e", "DOTNET_ENVIRONMENT=Development",
        "-e",
        "Logging__LogLevel__Microsoft.EntityFrameworkCore."
        "Database.Command=Warning",
        "api",
        "--bootstrap-admin",
    ]

    try:
        run_interactive(command, password)
    except BaseException:
        # Remove only this uniquely named temporary container.
        subprocess.run(
            ["docker", "rm", "-f", "-v", container],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30,
        )

        raise

    if sql_scalar(
        "SELECT COUNT(*) FROM dbo.AspNetUsers;"
    ) != "1":
        raise RuntimeError(
            "Expected exactly one temporary user."
        )

    if sql_scalar(
        "SELECT COUNT(*) FROM dbo.AspNetUsers u "
        "JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.Id "
        "JOIN dbo.AspNetRoles r ON r.Id = ur.RoleId "
        "WHERE u.IsActive = 1 "
        "AND r.NormalizedName = 'ADMINISTRATOR' "
        "AND u.Email = 'docker-admin@fieldops.example';"
    ) != "1":
        raise RuntimeError(
            "Temporary active administrator was not verified."
        )

    # Export credentials only after successful provisioning.
    with env_file.open("a", encoding="utf-8") as output:
        output.write(
            f"FIELDOPS_DOCKER_ADMIN_EMAIL={EMAIL}\n"
        )

        output.write(
            f"FIELDOPS_DOCKER_ADMIN_PASSWORD={password}\n"
        )

    print(
        "[OK] Isolated active administrator "
        "created and verified."
    )


if __name__ == "__main__":
    main()
