param(
    [switch]$UsePublishedImages
)

$ErrorActionPreference = "Stop"

$root = [IO.Path]::GetFullPath(
    (Join-Path (Join-Path $PSScriptRoot "..") "..")
)

Push-Location $root

try {
    $utf8 = New-Object System.Text.UTF8Encoding($false)

    $envPath = Join-Path $root ".env"
    $localDirectory = Join-Path $root ".fieldops-local"
    $tlsDirectory = Join-Path $localDirectory "tls"
    $certificatePath = Join-Path $tlsDirectory "localhost.crt"
    $privateKeyPath = Join-Path $tlsDirectory "localhost.key"

    # Compatible with Windows PowerShell 5.1 and PowerShell 7.
    $isUnixHost = (
        [Environment]::OSVersion.Platform -eq
        [PlatformID]::Unix
    )

    $certificateUser = "0:0"

    if ($isUnixHost) {
        $hostUid = id -u

        if ($LASTEXITCODE -ne 0 -or "$hostUid" -notmatch '^\d+$') {
            throw "Unable to determine the host user ID."
        }

        $hostGid = id -g

        if ($LASTEXITCODE -ne 0 -or "$hostGid" -notmatch '^\d+$') {
            throw "Unable to determine the host group ID."
        }

        $certificateUser = "${hostUid}:${hostGid}"
    }

    function New-LocalPassword {
        $randomBytes = New-Object byte[] 24
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()

        try {
            $generator.GetBytes($randomBytes)

            return "Aa1!" + (
                [BitConverter]::ToString($randomBytes).Replace("-", "")
            )
        }
        finally {
            $generator.Dispose()
            [Array]::Clear($randomBytes, 0, $randomBytes.Length)
        }
    }

    # Docker must be running in Linux mode.
    $dockerOs = docker info --format '{{.OSType}}'

    if ($LASTEXITCODE -ne 0 -or "$dockerOs" -ne "linux") {
        throw "Docker Linux engine is not available."
    }

    foreach ($variableName in @(
        "FIELDOPS_SQL_SA_PASSWORD",
        "FIELDOPS_SQL_APP_PASSWORD",
        "COMPOSE_PROJECT_NAME",
        "COMPOSE_FILE",
        "COMPOSE_ENV_FILES",
        "COMPOSE_DISABLE_ENV_FILE"
    )) {
        if (Test-Path "Env:$variableName") {
            throw "Conflicting environment variable: $variableName"
        }
    }

    Write-Host "[OK] Docker Linux engine available."

    # Protect local secrets from accidental Git inclusion.
    if (Test-Path -LiteralPath (Join-Path $root ".git")) {
        foreach ($privatePath in @(
            ".env",
            ".fieldops-local/tls/localhost.key",
            ".fieldops-local/tls/localhost.crt"
        )) {
            git check-ignore --no-index --quiet -- $privatePath

            if ($LASTEXITCODE -ne 0) {
                throw "Local file is not excluded from Git: $privatePath"
            }
        }
    }

    # Identify existing persistent resources.
    $existingVolumes = @(docker volume ls --format '{{.Name}}')

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect Docker volumes."
    }

    $sqlVolumeExists = $existingVolumes -contains "fieldops360_sqlserver-data"
    $tlsVolumeExists = $existingVolumes -contains "fieldops360_tls-material"

    # Generate both credentials before Compose interpolation.
    Write-Host "`n=== LOCAL CREDENTIALS ===" -ForegroundColor Cyan

    if (-not (Test-Path -LiteralPath $envPath)) {

        if ($sqlVolumeExists) {
            throw "SQL data volume exists but .env is missing. Restore the original credentials."
        }

        $saPassword = New-LocalPassword
        $appPassword = New-LocalPassword

        $envContent = "FIELDOPS_SQL_SA_PASSWORD=$saPassword`n" +
            "FIELDOPS_SQL_APP_PASSWORD=$appPassword`n"

        if ($isUnixHost) {
            sh -c 'umask 077; set -C; : > "$1"' sh $envPath

            if ($LASTEXITCODE -ne 0) {
                throw "Unable to create a private credentials file."
            }
        }

        [IO.File]::WriteAllText(
            $envPath,
            $envContent,
            $utf8
        )

        Write-Host "[OK] Independent SQL passwords generated."
    }
    else {
        Write-Host "[OK] Existing .env preserved."
    }

    if ($isUnixHost) {
        chmod 600 -- $envPath

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to secure local SQL credentials."
        }
    }

    $envContent = [IO.File]::ReadAllText($envPath)

    foreach ($variableName in @(
        "FIELDOPS_SQL_SA_PASSWORD",
        "FIELDOPS_SQL_APP_PASSWORD"
    )) {
        $entries = [regex]::Matches(
            $envContent,
            '(?m)^' + $variableName + '=([^\r\n]*)'
        )

        if (
            $entries.Count -ne 1 -or
            $entries[0].Groups[1].Value -notmatch '^Aa1![A-F0-9]{48}$'
        ) {
            throw "Missing or invalid generated credential: $variableName"
        }
    }

    $saEntry = [regex]::Match(
        $envContent,
        '(?m)^FIELDOPS_SQL_SA_PASSWORD=([^\r\n]+)'
    ).Groups[1].Value

    $appEntry = [regex]::Match(
        $envContent,
        '(?m)^FIELDOPS_SQL_APP_PASSWORD=([^\r\n]+)'
    ).Groups[1].Value

    if ($saEntry -ceq $appEntry) {
        throw "Administrative and runtime passwords must differ."
    }

    Write-Host "[OK] Local credentials validated without displaying them."

    # Validate Compose without printing its resolved secrets.
    docker compose --profile tools config --quiet

    if ($LASTEXITCODE -ne 0) {
        throw "Invalid Docker Compose configuration."
    }

    # Generate the local TLS certificate if necessary.
    Write-Host "`n=== LOCAL TLS CERTIFICATE ===" -ForegroundColor Cyan

    $certificateExists = Test-Path -LiteralPath $certificatePath -PathType Leaf
    $privateKeyExists = Test-Path -LiteralPath $privateKeyPath -PathType Leaf

    if ($certificateExists -ne $privateKeyExists) {
        throw "Incomplete TLS certificate pair."
    }

    if (-not $certificateExists) {

        if ($tlsVolumeExists) {
            throw "TLS volume exists but local certificate files are missing."
        }

        New-Item -ItemType Directory `
            -Path $tlsDirectory -Force | Out-Null

        if ($isUnixHost) {
            chmod 700 -- $localDirectory $tlsDirectory

            if ($LASTEXITCODE -ne 0) {
                throw "Unable to secure local TLS directories."
            }
        }

        docker run --rm `
            --network none `
            --user $certificateUser `
            --mount "type=bind,source=$tlsDirectory,target=/certs" `
            --entrypoint openssl `
            mcr.microsoft.com/dotnet/sdk:10.0 `
            req -x509 -newkey rsa:3072 -sha256 -nodes `
            -days 365 `
            -subj "/CN=localhost" `
            -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" `
            -addext "basicConstraints=critical,CA:FALSE" `
            -addext "keyUsage=critical,digitalSignature,keyEncipherment" `
            -addext "extendedKeyUsage=serverAuth" `
            -keyout /certs/localhost.key `
            -out /certs/localhost.crt

        if ($LASTEXITCODE -ne 0) {
            throw "TLS certificate generation failed."
        }

        Write-Host "[OK] Local TLS certificate generated."
    }
    else {
        Write-Host "[OK] Existing TLS certificate preserved."
    }

    if ($isUnixHost) {
        chmod 700 -- $localDirectory $tlsDirectory

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to secure local TLS directories."
        }

        chmod 600 -- $privateKeyPath

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to secure the local TLS private key."
        }

        chmod 644 -- $certificatePath

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to configure public certificate permissions."
        }

        Write-Host "[OK] Linux host TLS permissions verified."
    }

    # Verify certificate validity, hostname and private key.
    docker run --rm `
        --network none `
        --user 0:0 `
        --mount "type=bind,source=$tlsDirectory,target=/certs,readonly" `
        --entrypoint sh `
        mcr.microsoft.com/dotnet/sdk:10.0 `
        -c 'set -eu; openssl x509 -in /certs/localhost.crt -noout -checkend 0; openssl verify -CAfile /certs/localhost.crt -verify_hostname localhost /certs/localhost.crt; openssl x509 -in /certs/localhost.crt -pubkey -noout > /tmp/cert-public.pem; openssl pkey -in /certs/localhost.key -pubout > /tmp/key-public.pem; cmp -s /tmp/cert-public.pem /tmp/key-public.pem'

    if ($LASTEXITCODE -ne 0) {
        throw "TLS certificate or private key validation failed."
    }

    Write-Host "[OK] TLS certificate and key match."

    # Let Compose create and own the TLS volume.
    Write-Host "`n=== TLS VOLUME ===" -ForegroundColor Cyan

    if ($UsePublishedImages) {

        if ([string]::IsNullOrWhiteSpace($env:FIELDOPS_WEB_IMAGE)) {
            throw "Published frontend image reference is missing."
        }

        docker image inspect $env:FIELDOPS_WEB_IMAGE | Out-Null

        if ($LASTEXITCODE -ne 0) {
            throw "Published frontend image is not available locally."
        }

        Write-Host "[OK] Published frontend image available."
    }

    if (-not $tlsVolumeExists) {

        if (-not $UsePublishedImages) {
            docker compose build web

            if ($LASTEXITCODE -ne 0) {
                throw "Unable to build the frontend image."
            }
        }

        docker compose up --no-start --no-deps --no-build --pull never web

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to create the TLS volume."
        }

        docker run --rm `
            --network none `
            --user 0:0 `
            --mount "type=bind,source=$tlsDirectory,target=/tls-source,readonly" `
            --mount "type=volume,source=fieldops360_tls-material,target=/tls-target" `
            --entrypoint sh `
            mcr.microsoft.com/dotnet/sdk:10.0 `
            -c 'set -eu; test ! -e /tls-target/localhost.crt; test ! -e /tls-target/localhost.key; umask 077; cp /tls-source/localhost.crt /tls-target/localhost.crt; cp /tls-source/localhost.key /tls-target/localhost.key; chown 101:101 /tls-target /tls-target/localhost.crt /tls-target/localhost.key; chmod 700 /tls-target; chmod 644 /tls-target/localhost.crt; chmod 400 /tls-target/localhost.key'

        if ($LASTEXITCODE -ne 0) {
            throw "TLS volume initialization failed."
        }

        Write-Host "[OK] TLS volume initialized."
    }
    else {
        Write-Host "[OK] Existing TLS volume preserved."
    }

    # Verify the existing material without modifying it.
    docker run --rm `
        --network none `
        --user 0:0 `
        --mount "type=bind,source=$tlsDirectory,target=/tls-source,readonly" `
        --mount "type=volume,source=fieldops360_tls-material,target=/tls-target,readonly" `
        --entrypoint sh `
        mcr.microsoft.com/dotnet/sdk:10.0 `
        -c 'set -eu; cmp -s /tls-source/localhost.crt /tls-target/localhost.crt; cmp -s /tls-source/localhost.key /tls-target/localhost.key; test $(stat -c %u:%g:%a /tls-target) = 101:101:700; test $(stat -c %u:%g:%a /tls-target/localhost.crt) = 101:101:644; test $(stat -c %u:%g:%a /tls-target/localhost.key) = 101:101:400'

    if ($LASTEXITCODE -ne 0) {
        throw "TLS volume content or permissions do not match."
    }

    Write-Host "[OK] TLS volume content and permissions verified."
    Write-Host "[OK] Local environment initialized." -ForegroundColor Green
}
finally {
    Remove-Variable saPassword, appPassword, envContent, saEntry, appEntry, entries `
        -ErrorAction SilentlyContinue

    Pop-Location
}
