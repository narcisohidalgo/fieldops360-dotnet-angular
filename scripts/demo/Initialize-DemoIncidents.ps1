[CmdletBinding()]
param(
    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

$root = [IO.Path]::GetFullPath(
    (Join-Path (Join-Path $PSScriptRoot "..") "..")
)

Push-Location $root

$session = $null
$authenticated = $false
$csrf = $null

try {

    $baseUrl = "https://localhost:8443"

    # ============================================================
    # 1. API CLIENT
    # ============================================================

    function Invoke-FieldOpsApi {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Path,

            [string]$Method = "GET",

            [object]$Body,

            [string]$Token
        )

        if (
            $VerifyOnly -and
            $Method -ne "GET" -and
            $Path -notin @(
                "/api/auth/login",
                "/api/auth/logout"
            )
        ) {
            throw "Verification-only mode blocked a write request."
        }

        $parameters = @{
            Uri = "$baseUrl$Path"
            Method = $Method
            WebSession = $session
            UseBasicParsing = $true
            MaximumRedirection = 0
            TimeoutSec = 30
            ErrorAction = "Stop"
        }

        if ($Token) {
            $parameters.Headers = @{
                "X-XSRF-TOKEN" = $Token
            }
        }

        if ($null -ne $Body) {

            $parameters.ContentType = "application/json; charset=utf-8"

            $parameters.Body = [Text.Encoding]::UTF8.GetBytes(
                ($Body | ConvertTo-Json -Depth 10 -Compress)
            )
        }

        $response = Invoke-RestMethod @parameters

        # Windows PowerShell 5.1 collection compatibility.

        foreach ($item in $response) {
            if ($null -ne $item) {
                Write-Output $item
            }
        }
    }

    function Get-UniqueRecord {
        param(
            [object[]]$Records,
            [string]$Code
        )

        $found = @(
            $Records | Where-Object {
                $_.code -eq $Code
            }
        )

        if ($found.Count -ne 1) {
            throw "Expected exactly one reference record: $Code"
        }

        if ([string]::IsNullOrWhiteSpace([string]$found[0].id)) {
            throw "Invalid reference ID: $Code"
        }

        return $found[0]
    }

    function Assert-Incident {
        param(
            [object]$Actual,
            [object]$Expected
        )

        foreach ($field in @(
            "facilityId",
            "assetId",
            "title",
            "description",
            "priority"
        )) {

            if (
                [string]$Actual.$field -cne
                [string]$Expected.$field
            ) {
                throw "Existing incident differs: $($Expected.title), field $field. No overwrite performed."
            }
        }
    }

    # ============================================================
    # 2. VERIFY LOCAL DOCKER ENVIRONMENT
    # ============================================================

    Write-Host "`n=== LOCAL DOCKER ENVIRONMENT ===" -ForegroundColor Cyan

    foreach ($variableName in @(
        "COMPOSE_PROJECT_NAME",
        "COMPOSE_FILE",
        "COMPOSE_ENV_FILES",
        "COMPOSE_DISABLE_ENV_FILE"
    )) {

        if (Test-Path "Env:$variableName") {
            throw "Conflicting Compose variable: $variableName"
        }
    }

    $sqlId = docker compose ps -q sqlserver

    if (
        $LASTEXITCODE -ne 0 -or
        [string]::IsNullOrWhiteSpace($sqlId)
    ) {
        throw "Docker SQL Server is not running."
    }

    $inspectionOutput = @(docker inspect $sqlId)

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect SQL Server container."
    }

    $inspection = (
        $inspectionOutput -join "`n"
    ) | ConvertFrom-Json

    $sql = @($inspection)[0]

    if (
        $sql.Config.Labels.'com.docker.compose.project' -ne "fieldops360" -or
        $sql.State.Health.Status -ne "healthy"
    ) {
        throw "Unexpected Docker SQL Server environment."
    }

    $dataVolume = @(
        $sql.Mounts | Where-Object {
            $_.Name -eq "fieldops360_sqlserver-data" -and
            $_.Destination -eq "/var/opt/mssql"
        }
    )

    if ($dataVolume.Count -ne 1) {
        throw "Unexpected SQL Server data volume."
    }

    $port = docker compose port web 8443

    if (
        $LASTEXITCODE -ne 0 -or
        $port -ne "127.0.0.1:8443"
    ) {
        throw "Unexpected HTTPS endpoint."
    }

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    $status = Invoke-FieldOpsApi -Path "/api/system/status"

    if (
        $status.application -ne "FieldOps 360" -or
        $status.status -ne "online"
    ) {
        throw "Unexpected application status."
    }

    Write-Host "[OK] Local Docker environment verified."
    Write-Host "[OK] HTTPS API available."

    # ============================================================
    # 3. ADMINISTRATOR AUTHENTICATION
    # ============================================================

    Write-Host "`n=== ADMINISTRATOR AUTHENTICATION ===" -ForegroundColor Cyan

    $email = (Read-Host "Administrator email").Trim()

    if ([string]::IsNullOrWhiteSpace($email)) {
        throw "Administrator email is required."
    }

    $securePassword = Read-Host "Administrator password" -AsSecureString

    $credential = New-Object System.Management.Automation.PSCredential(
        $email,
        $securePassword
    )

    $anonymousCsrf = Invoke-FieldOpsApi -Path "/api/auth/csrf"

    if ([string]::IsNullOrWhiteSpace($anonymousCsrf.requestToken)) {
        throw "Missing anonymous CSRF token."
    }

    $loginBody = @{
        email = $credential.UserName
        password = $credential.GetNetworkCredential().Password
    }

    try {

        Invoke-FieldOpsApi `
            -Path "/api/auth/login" `
            -Method "POST" `
            -Body $loginBody `
            -Token $anonymousCsrf.requestToken | Out-Null

        $authenticated = $true
    }
    finally {

        $loginBody.Clear()

        Remove-Variable loginBody, credential, securePassword `
            -ErrorAction SilentlyContinue
    }

    $csrfResponse = Invoke-FieldOpsApi -Path "/api/auth/csrf"
    $csrf = $csrfResponse.requestToken

    if ([string]::IsNullOrWhiteSpace($csrf)) {
        throw "Missing authenticated CSRF token."
    }

    $me = Invoke-FieldOpsApi -Path "/api/auth/me"

    if ($me.roles -notcontains "Administrator") {
        throw "Administrator permissions are required."
    }

    Write-Host "[OK] Administrator authenticated."
    Write-Host "[OK] Authenticated CSRF token obtained."

    # ============================================================
    # 4. DEMONSTRATION INCIDENT DEFINITIONS
    # ============================================================

    # Priority:
    # 1 Low, 2 Medium, 3 High, 4 Critical.
    #
    # Status:
    # 1 Open, 2 InProgress, 3 Resolved, 4 Closed.
    #
    # Asset 0 means a facility-level incident without an asset.

    $definitions = @"
Number|Facility|Asset|Priority|TargetStatus|Title|Description
1|1|1|4|1|Parada de cinta transportadora|La línea de transporte permanece detenida y requiere intervención urgente.
2|1|2|3|2|Fallo hidráulico en carretilla|Se ha detectado pérdida de presión durante las operaciones de elevación.
3|1|3|2|3|Temperatura irregular en almacén|Se han observado desviaciones de temperatura en la zona de almacenamiento.
4|2|4|2|4|Presión irregular del compresor|Se registraron oscilaciones de presión durante el turno de producción.
5|2|5|4|1|Sobrecalentamiento del motor|El motor supera los valores normales de temperatura y permanece fuera de servicio.
6|2|6|3|2|Alarma en cuadro eléctrico|El sistema de protección ha generado una alerta pendiente de diagnóstico.
7|3|7|2|1|Desajuste del muelle de carga|La plataforma presenta dificultades durante las maniobras de carga.
8|3|8|3|3|Fallo del sistema de refrigeración|Se detectó una pérdida de rendimiento en el circuito de refrigeración.
9|3|9|2|2|Descenso de presión hidráulica|La bomba presenta fluctuaciones de presión durante el funcionamiento.
10|4|10|1|4|Revisión de batería del generador|Se identificó una degradación de capacidad durante la inspección preventiva.
11|4|11|3|1|Interrupciones en equipo de soldadura|El equipo experimenta cortes intermitentes durante su utilización.
12|4|12|4|2|Fallo de ventilación industrial|El sistema de extracción presenta una avería que requiere atención prioritaria.
13|5|13|2|3|Fuga en prensa hidráulica|Se detectó una pérdida de fluido en el circuito hidráulico.
14|5|14|3|1|Vibración anómala del motor|Las mediciones indican vibraciones superiores a los valores habituales.
15|5|15|1|4|Calibración de sensor de vibraciones|Se identificaron pequeñas desviaciones durante la calibración periódica.
16|6|16|2|2|Rendimiento irregular del servidor|El servidor de operaciones presenta un incremento de latencia.
17|6|17|1|1|Aviso de mantenimiento del SAI|El equipo ha generado un aviso de revisión preventiva.
18|7|19|3|3|Bloqueo del clasificador automático|Se produjo una interrupción durante la clasificación de mercancías.
19|8|23|2|2|Desajuste del robot industrial|El equipo requiere una revisión de sus parámetros de posicionamiento.
20|8|0|1|1|Revisión de iluminación de planta|Se solicita inspeccionar la iluminación de una zona común de producción.
"@ | ConvertFrom-Csv -Delimiter "|"

    if (@($definitions).Count -ne 20) {
        throw "Unexpected incident definition count."
    }

    $expectedStatuses = @{
        1 = 7
        2 = 6
        3 = 4
        4 = 3
    }

    $expectedPriorities = @{
        1 = 4
        2 = 7
        3 = 6
        4 = 3
    }

    foreach ($value in 1..4) {

        $statusCount = @(
            $definitions | Where-Object {
                [int]$_.TargetStatus -eq $value
            }
        ).Count

        $priorityCount = @(
            $definitions | Where-Object {
                [int]$_.Priority -eq $value
            }
        ).Count

        if (
            $statusCount -ne $expectedStatuses[$value] -or
            $priorityCount -ne $expectedPriorities[$value]
        ) {
            throw "Unexpected incident distribution."
        }
    }

    # ============================================================
    # 5. LOAD EXISTING DATA
    # ============================================================

    Write-Host "`n=== DEMO REFERENCE DATA ===" -ForegroundColor Cyan

    $facilities = @(
        Invoke-FieldOpsApi -Path "/api/facilities"
    )

    $assets = @(
        Invoke-FieldOpsApi -Path "/api/assets"
    )

    $existingIncidents = @(
        Invoke-FieldOpsApi -Path "/api/incidents"
    )

    foreach ($record in (
        $facilities + $assets + $existingIncidents
    )) {

        if (
            $null -eq $record -or
            $record -is [System.Array] -or
            [string]::IsNullOrWhiteSpace([string]$record.id)
        ) {
            throw "Unexpected API collection structure."
        }
    }

    $demoFacilities = @(
        $facilities | Where-Object {
            $_.code -like "DEMO-FAC-*"
        }
    )

    $demoAssets = @(
        $assets | Where-Object {
            $_.code -like "DEMO-AST-*"
        }
    )

    if (
        $demoFacilities.Count -ne 8 -or
        $demoAssets.Count -ne 24
    ) {
        throw "Run Initialize-DemoReferenceData.ps1 first."
    }

    Write-Host "[OK] Eight demo facilities available."
    Write-Host "[OK] Twenty-four demo assets available."
    Write-Host "[INFO] Existing incidents: $($existingIncidents.Count)"

    # ============================================================
    # 6. PREFLIGHT ALL INCIDENTS BEFORE ANY BUSINESS WRITE
    # ============================================================

    Write-Host "`n=== INCIDENT PREFLIGHT ===" -ForegroundColor Cyan

    $plan = @(

        foreach ($row in $definitions) {

            $key = "DEMO-INC-{0:D3}" -f [int]$row.Number
            $facilityCode = "DEMO-FAC-{0:D3}" -f [int]$row.Facility

            $facility = Get-UniqueRecord `
                -Records $facilities `
                -Code $facilityCode

            $assetId = $null

            if ([int]$row.Asset -gt 0) {

                $assetCode = "DEMO-AST-{0:D3}" -f [int]$row.Asset

                $asset = Get-UniqueRecord `
                    -Records $assets `
                    -Code $assetCode

                if ($asset.facilityId -ne $facility.id) {
                    throw "Asset belongs to a different facility: $assetCode"
                }

                $assetId = $asset.id
            }

            $body = [PSCustomObject]@{
                facilityId = $facility.id
                assetId = $assetId
                title = "$key - $($row.Title)"
                description = $row.Description
                priority = [int]$row.Priority
            }

            $found = @(
                $existingIncidents | Where-Object {
                    $_.title -like "$key - *"
                }
            )

            if ($found.Count -gt 1) {
                throw "Duplicate demo incident identifier: $key"
            }

            $existing = $null

            if ($found.Count -eq 1) {

                $existing = $found[0]

                Assert-Incident `
                    -Actual $existing `
                    -Expected $body

                if (
                    [int]$existing.status -lt 1 -or
                    [int]$existing.status -gt [int]$row.TargetStatus
                ) {
                    throw "Existing incident has an incompatible status: $key"
                }

                if (
                    $VerifyOnly -and
                    [int]$existing.status -ne [int]$row.TargetStatus
                ) {
                    throw "Verification-only mode: status differs for $key"
                }
            }
            elseif ($VerifyOnly) {
                throw "Verification-only mode: missing incident $key"
            }

            [PSCustomObject]@{
                Key = $key
                Body = $body
                TargetStatus = [int]$row.TargetStatus
                Existing = $existing
            }
        }
    )

    $plannedKeys = @($plan | ForEach-Object { $_.Key })

    if (
        $plan.Count -ne 20 -or
        @($plannedKeys | Select-Object -Unique).Count -ne 20
    ) {
        throw "Invalid incident initialization plan."
    }

    foreach ($incident in $existingIncidents) {

        if ($incident.title -like "DEMO-INC-*") {

            $key = ($incident.title -split " - ", 2)[0]

            if ($plannedKeys -notcontains $key) {
                throw "Unexpected existing demo incident: $key"
            }
        }
    }

    Write-Host "[OK] Twenty unique demo incident definitions."
    Write-Host "[OK] Facility and asset relationships validated."
    Write-Host "[OK] Existing incident conflicts checked."
    Write-Host "[OK] Expected priority and status distributions."

    # ============================================================
    # 7. CREATE INCIDENTS AND EXECUTE DOMAIN TRANSITIONS
    # ============================================================

    Write-Host "`n=== INITIALIZE DEMO INCIDENTS ===" -ForegroundColor Cyan

    $created = 0
    $transitions = 0
    $skipped = 0

    $actions = @{
        1 = "start"
        2 = "resolve"
        3 = "close"
    }

    $statusNames = @{
        1 = "Open"
        2 = "InProgress"
        3 = "Resolved"
        4 = "Closed"
    }

    foreach ($entry in $plan) {

        if ($null -ne $entry.Existing) {

            $incident = $entry.Existing

            if ([int]$incident.status -eq $entry.TargetStatus) {

                $skipped++

                Write-Host "[SKIP] $($entry.Key) already exists."

                continue
            }

            Write-Host "[RESUME] $($entry.Key)"
        }
        else {

            $incident = Invoke-FieldOpsApi `
                -Path "/api/incidents" `
                -Method "POST" `
                -Body $entry.Body `
                -Token $csrf

            if (
                [string]::IsNullOrWhiteSpace([string]$incident.id) -or
                [int]$incident.status -ne 1
            ) {
                throw "Unexpected incident creation response."
            }

            Assert-Incident `
                -Actual $incident `
                -Expected $entry.Body

            $created++

            Write-Host "[CREATED] $($incident.title)"
        }

        $currentStatus = [int]$incident.status

        while ($currentStatus -lt $entry.TargetStatus) {

            if (-not $actions.ContainsKey($currentStatus)) {
                throw "Unsupported incident transition."
            }

            $action = $actions[$currentStatus]
            $incidentId = $incident.id

            Invoke-FieldOpsApi `
                -Path "/api/incidents/$incidentId/$action" `
                -Method "PATCH" `
                -Token $csrf | Out-Null

            $incident = Invoke-FieldOpsApi `
                -Path "/api/incidents/$incidentId"

            $expectedStatus = $currentStatus + 1

            if ([int]$incident.status -ne $expectedStatus) {
                throw "Unexpected transition result: $($entry.Key)"
            }

            $currentStatus = [int]$incident.status
            $transitions++

            Write-Host "[STATUS] $($entry.Key) -> $($statusNames[$currentStatus])"
        }
    }

    # ============================================================
    # 8. VERIFY ALL INCIDENTS THROUGH THE API
    # ============================================================

    Write-Host "`n=== DEMO INCIDENT VERIFICATION ===" -ForegroundColor Cyan

    $allIncidents = @(
        Invoke-FieldOpsApi -Path "/api/incidents"
    )

    $demoIncidents = @(
        $allIncidents | Where-Object {
            $_.title -like "DEMO-INC-*"
        }
    )

    if ($demoIncidents.Count -ne 20) {
        throw "Unexpected demo incident count: $($demoIncidents.Count)"
    }

    foreach ($entry in $plan) {

        $found = @(
            $demoIncidents | Where-Object {
                $_.title -like "$($entry.Key) - *"
            }
        )

        if ($found.Count -ne 1) {
            throw "Unexpected incident identifier count: $($entry.Key)"
        }

        $actual = $found[0]

        Assert-Incident `
            -Actual $actual `
            -Expected $entry.Body

        if ([int]$actual.status -ne $entry.TargetStatus) {
            throw "Unexpected final status: $($entry.Key)"
        }

        if (
            [int]$actual.status -ge 3 -and
            [string]::IsNullOrWhiteSpace([string]$actual.resolvedAtUtc)
        ) {
            throw "Missing resolution timestamp: $($entry.Key)"
        }

        if (
            [int]$actual.status -eq 4 -and
            [string]::IsNullOrWhiteSpace([string]$actual.closedAtUtc)
        ) {
            throw "Missing closing timestamp: $($entry.Key)"
        }
    }

    foreach ($previous in $existingIncidents) {

        $found = @(
            $allIncidents | Where-Object {
                $_.id -eq $previous.id
            }
        )

        if ($found.Count -ne 1) {
            throw "Previously existing incident is missing."
        }

        if ($previous.title -notlike "DEMO-INC-*") {

            Assert-Incident `
                -Actual $found[0] `
                -Expected $previous

            if (
                [int]$found[0].status -ne [int]$previous.status -or
                [string]$found[0].updatedAtUtc -cne [string]$previous.updatedAtUtc
            ) {
                throw "A non-demo incident changed during initialization."
            }
        }
    }

    $priorityNames = @{
        1 = "Low"
        2 = "Medium"
        3 = "High"
        4 = "Critical"
    }

    Write-Host "`n=== DEMO STATUS DISTRIBUTION ===" -ForegroundColor Cyan

    @(
        foreach ($value in 1..4) {

            $count = @(
                $demoIncidents | Where-Object {
                    [int]$_.status -eq $value
                }
            ).Count

            if ($count -ne $expectedStatuses[$value]) {
                throw "Unexpected final status distribution."
            }

            [PSCustomObject]@{
                Status = $statusNames[$value]
                Records = $count
            }
        }
    ) | Format-Table -AutoSize | Out-Host

    Write-Host "`n=== DEMO PRIORITY DISTRIBUTION ===" -ForegroundColor Cyan

    @(
        foreach ($value in 1..4) {

            $count = @(
                $demoIncidents | Where-Object {
                    [int]$_.priority -eq $value
                }
            ).Count

            if ($count -ne $expectedPriorities[$value]) {
                throw "Unexpected final priority distribution."
            }

            [PSCustomObject]@{
                Priority = $priorityNames[$value]
                Records = $count
            }
        }
    ) | Format-Table -AutoSize | Out-Host

    Write-Host "`n=== FINAL INCIDENT COUNTS ===" -ForegroundColor Cyan

    Write-Host "[INFO] Created incidents: $created"
    Write-Host "[INFO] Status transitions: $transitions"
    Write-Host "[INFO] Already complete: $skipped"
    Write-Host "[INFO] Demo incidents: $($demoIncidents.Count)"
    Write-Host "[INFO] Total incidents: $($allIncidents.Count)"

    Write-Host "[OK] All demo incidents verified."
    Write-Host "[OK] All four incident statuses represented."
    Write-Host "[OK] All four incident priorities represented."
    Write-Host "[OK] Resolution and closing timestamps verified."
    Write-Host "[OK] Previously existing non-demo incidents preserved."

    if ($VerifyOnly) {

        if ($created -ne 0 -or $transitions -ne 0) {
            throw "Unexpected business writes in verification-only mode."
        }

        Write-Host "[OK] Verification-only mode completed."
    }
}
finally {

    if ($authenticated -and $null -ne $session) {

        try {

            $logoutCsrf = Invoke-FieldOpsApi -Path "/api/auth/csrf"

            Invoke-FieldOpsApi `
                -Path "/api/auth/logout" `
                -Method "POST" `
                -Token $logoutCsrf.requestToken | Out-Null

            Write-Host "[OK] Administrator API session closed."
        }
        catch {
            Write-Warning "Unable to confirm API logout."
        }
    }

    Remove-Variable credential, securePassword, session, csrf, sql, inspection, inspectionOutput `
        -ErrorAction SilentlyContinue

    Pop-Location
}

Write-Host "`n[OK] DEMO INCIDENTS READY." -ForegroundColor Green
