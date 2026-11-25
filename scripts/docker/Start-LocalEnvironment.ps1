param(
    [ValidatePattern('^[a-fA-F0-9]{40}$')]
    [string]$PublishedCommit
)

$ErrorActionPreference = "Stop"

$imageVariables = @(
    "FIELDOPS_API_IMAGE",
    "FIELDOPS_WEB_IMAGE",
    "FIELDOPS_MIGRATIONS_IMAGE"
)

foreach ($variableName in $imageVariables) {
    if (Test-Path "Env:$variableName") {
        throw "Conflicting image environment variable: $variableName"
    }
}

try {
    if ($PublishedCommit) {
        $prefix = "ghcr.io/narcisohidalgo/fieldops360-dotnet-angular"
        $tag = "sha-" + $PublishedCommit.ToLowerInvariant()

        $env:FIELDOPS_API_IMAGE = "${prefix}-api:${tag}"
        $env:FIELDOPS_WEB_IMAGE = "${prefix}-web:${tag}"
        $env:FIELDOPS_MIGRATIONS_IMAGE = "${prefix}-migrations:${tag}"

        Write-Host "[INFO] Installation from published GHCR images."
        Write-Host "Revision: $PublishedCommit"

        Write-Host "`n=== PUBLISHED IMAGE PREFLIGHT ===" -ForegroundColor Cyan

        $expectedRevision = $PublishedCommit.ToLowerInvariant()

        foreach ($image in @(
            $env:FIELDOPS_API_IMAGE,
            $env:FIELDOPS_WEB_IMAGE,
            $env:FIELDOPS_MIGRATIONS_IMAGE
        )) {

            docker pull --platform linux/amd64 $image

            if ($LASTEXITCODE -ne 0) {
                throw "Unable to download published image: $image"
            }

            $labelsJson = docker image inspect `
                --format '{{json .Config.Labels}}' $image

            if ($LASTEXITCODE -ne 0) {
                throw "Unable to inspect image metadata: $image"
            }

            $labels = $labelsJson | ConvertFrom-Json

            if (
                $null -eq $labels -or
                $labels.'org.opencontainers.image.revision' -cne $expectedRevision
            ) {
                throw "Unexpected source revision in image: $image"
            }

            $platform = docker image inspect `
                --format '{{.Os}}/{{.Architecture}}' $image

            if (
                $LASTEXITCODE -ne 0 -or
                "$platform" -ne "linux/amd64"
            ) {
                throw "Unexpected image platform: $image"
            }

            Write-Host "[OK] Published image verified: $image" -ForegroundColor Green
        }

        Write-Host "[OK] All published images verified before initialization." -ForegroundColor Green
    }
    else {
        $env:FIELDOPS_API_IMAGE = "fieldops360-api:local"
        $env:FIELDOPS_WEB_IMAGE = "fieldops360-web:local"
        $env:FIELDOPS_MIGRATIONS_IMAGE = "fieldops360-migrations:local"

        Write-Host "[INFO] Installation from local source."
    }

$ErrorActionPreference = "Stop"

$root = [IO.Path]::GetFullPath(
    (Join-Path (Join-Path $PSScriptRoot "..") "..")
)

Push-Location $root

try {
    function Assert-NativeSuccess {
        param(
            [int]$ExitCode,
            [string]$Operation
        )

        if ($ExitCode -ne 0) {
            throw "$Operation failed (exit code $ExitCode)."
        }
    }

    Write-Host "`n=== FIELDOPS 360 - LOCAL DOCKER STARTUP ===" -ForegroundColor Cyan

    # 1. Initialize local credentials and TLS material.
    Write-Host "`n=== 1. LOCAL ENVIRONMENT ===" -ForegroundColor Cyan

    & (Join-Path $PSScriptRoot "Initialize-LocalEnvironment.ps1") -UsePublishedImages:([bool]$PublishedCommit)

    # 2. Start SQL Server and wait for its health check.
    Write-Host "`n=== 2. SQL SERVER ===" -ForegroundColor Cyan

    docker compose up --detach --wait `
        --wait-timeout 180 sqlserver

    Assert-NativeSuccess $LASTEXITCODE "SQL Server startup"

    Write-Host "[OK] SQL Server healthy." -ForegroundColor Green

    # 3. Build and execute EF Core migrations.
    Write-Host "`n=== 3. DATABASE MIGRATIONS ===" -ForegroundColor Cyan

    if ($PublishedCommit) {
        docker image inspect $env:FIELDOPS_MIGRATIONS_IMAGE | Out-Null
    }
    else {
        docker compose build migrate
    }

    Assert-NativeSuccess $LASTEXITCODE "Migration image preparation"

    docker compose run --rm --no-deps --pull never -T migrate

    Assert-NativeSuccess $LASTEXITCODE "Database migrations"

    Write-Host "[OK] Database schema up to date." -ForegroundColor Green

    # 4. Provision the restricted SQL application account.
    Write-Host "`n=== 4. DATABASE RUNTIME SECURITY ===" -ForegroundColor Cyan

    & (Join-Path $PSScriptRoot "Initialize-DatabaseRuntime.ps1")

    # 5. Build backend and frontend images.
    Write-Host "`n=== 5. APPLICATION IMAGES ===" -ForegroundColor Cyan

    if ($PublishedCommit) {
        docker image inspect $env:FIELDOPS_API_IMAGE | Out-Null
    }
    else {
        docker compose build api web
    }

    Assert-NativeSuccess $LASTEXITCODE "Application image preparation"

    Write-Host "[OK] Application images available." -ForegroundColor Green

    # 6. Determine whether first-admin bootstrap is necessary.
    Write-Host "`n=== 6. ADMINISTRATOR BOOTSTRAP ===" -ForegroundColor Cyan

    $adminQuery = @(
        "SET NOCOUNT ON;"
        "SELECT CONCAT('Administrators=', COUNT(*))"
        "FROM dbo.AspNetUsers u"
        "INNER JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.Id"
        "INNER JOIN dbo.AspNetRoles r ON r.Id = ur.RoleId"
        "WHERE r.NormalizedName = 'ADMINISTRATOR';"
        "SELECT CONCAT('ActiveAdministrators=', COUNT(*))"
        "FROM dbo.AspNetUsers u"
        "INNER JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.Id"
        "INNER JOIN dbo.AspNetRoles r ON r.Id = ur.RoleId"
        "WHERE r.NormalizedName = 'ADMINISTRATOR'"
        "AND u.IsActive = 1;"
        "GO"
    )

    function Get-AdministratorState {

        $queryResult = $adminQuery |
            docker compose exec -T sqlserver sh -c `
            'export SQLCMDPASSWORD=$MSSQL_SA_PASSWORD; exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -d FieldOpsDockerDb -h -1 -W'

        Assert-NativeSuccess $LASTEXITCODE "Administrator query"

        $state = @{}

        foreach ($line in $queryResult) {
            if (
                $line.Trim() -match
                '^(Administrators|ActiveAdministrators)=(\d+)$'
            ) {
                $state[$Matches[1]] = [int]$Matches[2]
            }
        }

        if ($state.Count -ne 2) {
            throw "Unable to determine administrator state."
        }

        return $state
    }

    $adminState = Get-AdministratorState

    if ($adminState.Administrators -eq 0) {

        Write-Host "Create the first FieldOps administrator."
        Write-Host "The password must satisfy the Identity password policy."

        docker compose run --rm --no-deps --pull never `
            -e ASPNETCORE_ENVIRONMENT=Development `
            -e DOTNET_ENVIRONMENT=Development `
            -e Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command=Warning `
            api --bootstrap-admin

        Assert-NativeSuccess $LASTEXITCODE "Administrator bootstrap"
    }
    else {
        Write-Host "[OK] Existing administrators preserved."
    }

    $adminState = Get-AdministratorState

    if ($adminState.ActiveAdministrators -lt 1) {
        throw "No active administrator is available."
    }

    Write-Host "[OK] Active administrator available." -ForegroundColor Green

    # 7. Start the production application services.
    Write-Host "`n=== 7. APPLICATION STARTUP ===" -ForegroundColor Cyan

    docker compose up --detach --no-deps --no-build --pull never `
        --wait --wait-timeout 120 api web

    Assert-NativeSuccess $LASTEXITCODE "Application startup"

    # 8. Verify HTTPS with explicit certificate trust.
    # Use a temporary Node.js container, so Node.js is not
    # required on the host machine for this startup script.
    Write-Host "`n=== 8. HTTPS AVAILABILITY ===" -ForegroundColor Cyan

    $certificatePath = Join-Path $root `
        ".fieldops-local/tls/localhost.crt"

    $nodeValidation = @"
const https = require('node:https');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const ca = fs.readFileSync('/certs/localhost.crt');

function get(path) {
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname: 'web',
            servername: 'localhost',
            port: 8443,
            path,
            ca,
            rejectUnauthorized: true,
            headers: {
                Host: 'localhost:8443'
            },
            timeout: 5000
        }, res => {
            let body = '';
            const authorized = res.socket.authorized;

            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                authorized,
                body
            }));
            res.on('error', reject);
        });

        req.on('timeout', () => {
            req.destroy(new Error('HTTPS timeout'));
        });

        req.on('error', reject);
    });
}

async function main() {
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            const page = await get('/');

            assert.equal(page.status, 200);
            assert.equal(page.authorized, true);
            assert.match(page.body, /<app-root/);

            const api = await get('/api/system/status');

            assert.equal(api.status, 200);
            assert.equal(api.authorized, true);
            assert.equal(JSON.parse(api.body).status, 'online');

            const csrf = await get('/api/auth/csrf');

            assert.equal(csrf.status, 200);
            assert.ok(JSON.parse(csrf.body).requestToken);

            const session = await get('/api/auth/me');

            assert.equal(session.status, 401);

            console.log('[OK] Angular frontend available.');
            console.log('[OK] HTTPS certificate validated.');
            console.log('[OK] Backend reverse proxy operational.');
            console.log('[OK] CSRF endpoint available.');
            console.log('[OK] Anonymous authentication rejected.');

            return;
        } catch (error) {
            if (attempt === 30) throw error;

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
"@

    $nodeValidation |
        docker run --rm -i `
            --network fieldops360_proxy-network `
            --mount "type=bind,source=$certificatePath,target=/certs/localhost.crt,readonly" `
            --entrypoint node `
            node:24-bookworm-slim -

    Assert-NativeSuccess $LASTEXITCODE "HTTPS availability check"

    # 9. Verify that the published port is restricted to localhost.
    $publishedPort = docker compose port web 8443

    Assert-NativeSuccess $LASTEXITCODE "HTTPS port verification"

    if ("$publishedPort" -ne "127.0.0.1:8443") {
        throw "Unexpected HTTPS port binding."
    }

    Write-Host "`n=== FIELDOPS 360 STATUS ===" -ForegroundColor Cyan

    docker compose ps

    Assert-NativeSuccess $LASTEXITCODE "Compose status"

    Write-Host "`n[OK] FieldOps 360 local environment ready." -ForegroundColor Green
    Write-Host "URL: https://localhost:8443" -ForegroundColor Cyan
    Write-Host "For browser access, trust the generated local certificate explicitly."
}
finally {
    Pop-Location
}

}
finally {
    foreach ($variableName in $imageVariables) {
        Remove-Item "Env:$variableName" `
            -ErrorAction SilentlyContinue
    }
}
