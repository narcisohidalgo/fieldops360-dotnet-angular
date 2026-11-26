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
            throw "Verification-only mode blocked a business write."
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

        if (
            $found.Count -ne 1 -or
            [string]::IsNullOrWhiteSpace([string]$found[0].id)
        ) {
            throw "Expected exactly one reference: $Code"
        }

        return $found[0]
    }

    function Assert-Order {
        param(
            [object]$Actual,
            [object]$Expected
        )

        foreach ($field in @(
            "code",
            "title",
            "description",
            "facilityId",
            "assetId",
            "incidentId",
            "technicianId",
            "priority"
        )) {

            if (
                [string]$Actual.$field -cne
                [string]$Expected.$field
            ) {
                throw "Work order mismatch: $($Expected.code), field $field"
            }
        }

        foreach ($field in @(
            "scheduledStartUtc",
            "dueAtUtc"
        )) {

            if (
                $null -eq $Actual.$field -or
                $null -eq $Expected.$field
            ) {
                throw "Missing schedule: $($Expected.code)"
            }

            if (
                [DateTimeOffset]$Actual.$field -ne
                [DateTimeOffset]$Expected.$field
            ) {
                throw "Work order schedule differs: $($Expected.code)"
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
        throw "Unable to inspect SQL Server."
    }

    $inspection = (
        $inspectionOutput -join "`n"
    ) | ConvertFrom-Json

    $sql = @($inspection)[0]

    if (
        $sql.Config.Labels.'com.docker.compose.project' -ne "fieldops360" -or
        $sql.State.Health.Status -ne "healthy"
    ) {
        throw "Unexpected SQL Server environment."
    }

    $volume = @(
        $sql.Mounts | Where-Object {
            $_.Name -eq "fieldops360_sqlserver-data" -and
            $_.Destination -eq "/var/opt/mssql"
        }
    )

    if ($volume.Count -ne 1) {
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
    # 4. WORK ORDER DEFINITIONS
    # ============================================================

    # Priority:
    # 1 Low, 2 Medium, 3 High, 4 Critical.
    #
    # Status:
    # 1 Planned, 2 InProgress, 3 Completed, 4 Cancelled.
    #
    # Technician 0 = unassigned.
    # Incident 0 = independent preventive maintenance.
    # StartDay and DueDay are relative UTC day offsets.

    $definitions = @"
Number|Facility|Asset|Incident|Technician|Priority|TargetStatus|StartDay|DueDay|Title
1|1|1|1|1|4|1|-3|-1|Reparación de cinta transportadora
2|1|2|2|5|3|2|-4|-1|Reparación hidráulica de carretilla
3|1|3|3|4|2|3|-5|-2|Ajuste de climatización del almacén
4|2|4|4|1|2|3|-6|-3|Estabilización del compresor
5|2|5|5|0|4|1|-4|-2|Diagnóstico de sobrecalentamiento
6|2|6|6|2|3|2|-1|2|Inspección de protecciones eléctricas
7|3|7|7|0|2|1|1|4|Ajuste del muelle de carga
8|3|8|8|4|3|3|-5|-2|Reparación del circuito de refrigeración
9|3|9|9|5|2|2|-3|-1|Revisión de bomba hidráulica
10|4|10|10|2|1|3|-6|-3|Sustitución de batería del generador
11|4|11|11|2|3|4|-2|1|Inspección del equipo de soldadura
12|4|12|12|4|4|2|-1|1|Reparación de ventilación industrial
13|5|13|13|5|2|3|-5|-2|Reparación de prensa hidráulica
14|5|14|14|1|3|1|-3|-1|Diagnóstico de vibraciones del motor
15|5|15|15|3|1|3|-6|-3|Calibración del sensor de vibraciones
16|6|16|16|6|2|2|-3|-1|Optimización del servidor de operaciones
17|6|17|17|6|1|1|1|5|Revisión preventiva del SAI
18|7|19|18|3|3|3|-4|-1|Reparación del clasificador automático
19|8|23|19|8|2|2|-1|3|Ajuste de posicionamiento del robot
20|8|0|20|2|1|4|2|5|Inspección de iluminación general
21|7|20|0|0|2|1|2|6|Mantenimiento preventivo de rodillos
22|8|22|0|7|2|1|1|7|Inspección de línea de ensamblaje
23|6|18|0|0|1|1|3|8|Revisión periódica de climatización
24|7|21|0|7|1|4|2|6|Mantenimiento de puerta industrial
"@ | ConvertFrom-Csv -Delimiter "|"

    $cancellationReasons = @{
        11 = "Intervención reprogramada para una nueva ventana de mantenimiento."
        20 = "Inspección pendiente de coordinación con el responsable de planta."
        24 = "Mantenimiento aplazado por necesidades operativas."
    }

    $expectedStatuses = @{
        1 = 8
        2 = 6
        3 = 7
        4 = 3
    }

    $statusNames = @{
        1 = "Planned"
        2 = "InProgress"
        3 = "Completed"
        4 = "Cancelled"
    }

    if (@($definitions).Count -ne 24) {
        throw "Expected twenty-four work order definitions."
    }

    foreach ($value in 1..4) {

        $count = @(
            $definitions | Where-Object {
                [int]$_.TargetStatus -eq $value
            }
        ).Count

        if ($count -ne $expectedStatuses[$value]) {
            throw "Unexpected work order status distribution."
        }
    }

    # ============================================================
    # 5. LOAD EXISTING RECORDS
    # ============================================================

    Write-Host "`n=== DEMO REFERENCE DATA ===" -ForegroundColor Cyan

    $facilities = @(
        Invoke-FieldOpsApi -Path "/api/facilities"
    )

    $assets = @(
        Invoke-FieldOpsApi -Path "/api/assets"
    )

    $technicians = @(
        Invoke-FieldOpsApi -Path "/api/technicians"
    )

    $incidents = @(
        Invoke-FieldOpsApi -Path "/api/incidents"
    )

    $existingOrders = @(
        Invoke-FieldOpsApi -Path "/api/work-orders"
    )

    foreach ($record in (
        $facilities + $assets + $technicians +
        $incidents + $existingOrders
    )) {

        if (
            $null -eq $record -or
            $record -is [System.Array] -or
            [string]::IsNullOrWhiteSpace([string]$record.id)
        ) {
            throw "Unexpected API collection structure."
        }
    }

    if (
        @($facilities | Where-Object {
            $_.code -like "DEMO-FAC-*"
        }).Count -ne 8 -or
        @($assets | Where-Object {
            $_.code -like "DEMO-AST-*"
        }).Count -ne 24 -or
        @($technicians | Where-Object {
            $_.code -like "DEMO-TEC-*"
        }).Count -ne 8 -or
        @($incidents | Where-Object {
            $_.title -like "DEMO-INC-*"
        }).Count -ne 20
    ) {
        throw "Initialize demo reference data and incidents first."
    }

    Write-Host "[OK] Eight demo facilities available."
    Write-Host "[OK] Twenty-four demo assets available."
    Write-Host "[OK] Eight demo technicians available."
    Write-Host "[OK] Twenty demo incidents available."
    Write-Host "[INFO] Existing work orders: $($existingOrders.Count)"

    # ============================================================
    # 6. PREFLIGHT ALL WORK ORDERS
    # ============================================================

    Write-Host "`n=== WORK ORDER PREFLIGHT ===" -ForegroundColor Cyan

    $todayUtc = [DateTime]::UtcNow.Date

    $plan = @(

        foreach ($row in $definitions) {

            $number = [int]$row.Number
            $target = [int]$row.TargetStatus
            $code = "DEMO-WO-{0:D3}" -f $number

            $facilityCode = "DEMO-FAC-{0:D3}" -f [int]$row.Facility

            $facility = Get-UniqueRecord `
                -Records $facilities `
                -Code $facilityCode

            $assetId = $null
            $incidentId = $null
            $technicianId = $null

            if ([int]$row.Asset -gt 0) {

                $assetCode = "DEMO-AST-{0:D3}" -f [int]$row.Asset

                $asset = Get-UniqueRecord `
                    -Records $assets `
                    -Code $assetCode

                if ($asset.facilityId -ne $facility.id) {
                    throw "Asset facility mismatch: $code"
                }

                $assetId = $asset.id
            }

            if ([int]$row.Incident -gt 0) {

                $incidentKey = "DEMO-INC-{0:D3}" -f [int]$row.Incident

                $foundIncident = @(
                    $incidents | Where-Object {
                        $_.title -like "$incidentKey - *"
                    }
                )

                if ($foundIncident.Count -ne 1) {
                    throw "Expected one incident: $incidentKey"
                }

                $incident = $foundIncident[0]

                if ($incident.facilityId -ne $facility.id) {
                    throw "Incident facility mismatch: $code"
                }

                if (
                    [string]$incident.assetId -ne
                    [string]$assetId
                ) {
                    throw "Incident asset mismatch: $code"
                }

                $incidentId = $incident.id
            }

            if ([int]$row.Technician -gt 0) {

                $technicianCode = "DEMO-TEC-{0:D3}" -f [int]$row.Technician

                $technician = Get-UniqueRecord `
                    -Records $technicians `
                    -Code $technicianCode

                if (-not $technician.isActive) {
                    throw "Inactive technician: $technicianCode"
                }

                $technicianId = $technician.id
            }

            if (
                $target -in @(2, 3) -and
                $null -eq $technicianId
            ) {
                throw "A technician is required: $code"
            }

            if ([int]$row.DueDay -lt [int]$row.StartDay) {
                throw "Invalid schedule: $code"
            }

            if (
                $target -eq 4 -and
                -not $cancellationReasons.ContainsKey($number)
            ) {
                throw "Missing cancellation reason: $code"
            }

            $found = @(
                $existingOrders | Where-Object {
                    $_.code -eq $code
                }
            )

            if ($found.Count -gt 1) {
                throw "Duplicate work order code: $code"
            }

            $existing = $null
            $scheduleBase = $todayUtc

            if ($found.Count -eq 1) {

                $existing = $found[0]

                # Preserve dates when the script is rerun.
                # Derive the original schedule baseline from
                # its persisted creation timestamp.

                $creationDay = (
                    [DateTimeOffset]$existing.createdAtUtc
                ).UtcDateTime.Date

                $scheduleBase = $creationDay

                $expectedStart = $scheduleBase.AddDays(
                    [int]$row.StartDay
                ).AddHours(8)

                # Allow initialization across UTC midnight.
                if (
                    [DateTimeOffset]$existing.scheduledStartUtc -eq
                    [DateTimeOffset]$expectedStart.AddDays(-1)
                ) {
                    $scheduleBase = $creationDay.AddDays(-1)
                }
            }
            elseif ($VerifyOnly) {
                throw "Verification-only mode: missing $code"
            }

            $scheduledStart = $scheduleBase.AddDays(
                [int]$row.StartDay
            ).AddHours(8)

            $dueAt = $scheduleBase.AddDays(
                [int]$row.DueDay
            ).AddHours(16)

            $description = if ($null -ne $incidentId) {
                "Intervención correctiva de demostración vinculada a una incidencia operativa."
            }
            else {
                "Intervención preventiva de demostración independiente de incidencias."
            }

            $body = [PSCustomObject]@{
                facilityId = $facility.id
                assetId = $assetId
                incidentId = $incidentId
                technicianId = $technicianId
                code = $code
                title = $row.Title
                description = $description
                priority = [int]$row.Priority
                scheduledStartUtc = $scheduledStart.ToString("o")
                dueAtUtc = $dueAt.ToString("o")
            }

            $reason = $null

            if ($target -eq 4) {
                $reason = $cancellationReasons[$number]
            }

            if ($null -ne $existing) {

                Assert-Order `
                    -Actual $existing `
                    -Expected $body

                $current = [int]$existing.status

                $allowedStatuses = switch ($target) {
                    1 { @(1) }
                    2 { @(1, 2) }
                    3 { @(1, 2, 3) }
                    4 { @(1, 4) }
                }

                if ($current -notin $allowedStatuses) {
                    throw "Existing work order status is incompatible: $code"
                }

                if (
                    $current -eq 4 -and
                    $existing.cancellationReason -cne $reason
                ) {
                    throw "Existing cancellation reason differs: $code"
                }

                if ($VerifyOnly -and $current -ne $target) {
                    throw "Verification-only mode: status differs for $code"
                }
            }

            [PSCustomObject]@{
                Code = $code
                Body = $body
                TargetStatus = $target
                Reason = $reason
                Existing = $existing
            }
        }
    )

    $plannedCodes = @($plan | ForEach-Object { $_.Code })

    if (
        $plan.Count -ne 24 -or
        @($plannedCodes | Select-Object -Unique).Count -ne 24
    ) {
        throw "Invalid work order initialization plan."
    }

    foreach ($order in $existingOrders) {

        if (
            $order.code -like "DEMO-WO-*" -and
            $plannedCodes -notcontains $order.code
        ) {
            throw "Unexpected existing demo work order: $($order.code)"
        }
    }

    Write-Host "[OK] Twenty-four unique work order definitions."
    Write-Host "[OK] Facility, asset and incident relationships."
    Write-Host "[OK] Active technician assignments."
    Write-Host "[OK] UTC scheduling and due dates."
    Write-Host "[OK] Cancellation reasons."
    Write-Host "[OK] Existing work order conflicts checked."

    # ============================================================
    # 7. CREATE WORK ORDERS AND EXECUTE TRANSITIONS
    # ============================================================

    Write-Host "`n=== INITIALIZE DEMO WORK ORDERS ===" -ForegroundColor Cyan

    $created = 0
    $transitions = 0
    $skipped = 0

    foreach ($entry in $plan) {

        if ($null -ne $entry.Existing) {

            $order = $entry.Existing

            if ([int]$order.status -eq $entry.TargetStatus) {

                $skipped++

                Write-Host "[SKIP] $($entry.Code) already exists."

                continue
            }

            Write-Host "[RESUME] $($entry.Code)"
        }
        else {

            $order = Invoke-FieldOpsApi `
                -Path "/api/work-orders" `
                -Method "POST" `
                -Body $entry.Body `
                -Token $csrf

            if (
                [string]::IsNullOrWhiteSpace([string]$order.id) -or
                [int]$order.status -ne 1
            ) {
                throw "Unexpected work order creation response."
            }

            Assert-Order `
                -Actual $order `
                -Expected $entry.Body

            $created++

            Write-Host "[CREATED] $($order.code) - $($order.title)"
        }

        while ([int]$order.status -ne $entry.TargetStatus) {

            $orderId = $order.id
            $currentStatus = [int]$order.status

            if ($entry.TargetStatus -eq 4) {

                if ($currentStatus -ne 1) {
                    throw "Unexpected cancellation source status."
                }

                Invoke-FieldOpsApi `
                    -Path "/api/work-orders/$orderId/cancel" `
                    -Method "PATCH" `
                    -Body @{ reason = $entry.Reason } `
                    -Token $csrf | Out-Null

                $expectedStatus = 4
            }
            elseif ($currentStatus -eq 1) {

                Invoke-FieldOpsApi `
                    -Path "/api/work-orders/$orderId/start" `
                    -Method "PATCH" `
                    -Token $csrf | Out-Null

                $expectedStatus = 2
            }
            elseif (
                $currentStatus -eq 2 -and
                $entry.TargetStatus -eq 3
            ) {

                Invoke-FieldOpsApi `
                    -Path "/api/work-orders/$orderId/complete" `
                    -Method "PATCH" `
                    -Token $csrf | Out-Null

                $expectedStatus = 3
            }
            else {
                throw "Unsupported work order transition."
            }

            $order = Invoke-FieldOpsApi `
                -Path "/api/work-orders/$orderId"

            if ([int]$order.status -ne $expectedStatus) {
                throw "Unexpected transition result: $($entry.Code)"
            }

            $transitions++

            Write-Host "[STATUS] $($entry.Code) -> $($statusNames[[int]$order.status])"
        }
    }

    # ============================================================
    # 8. VERIFY ALL DEMO WORK ORDERS
    # ============================================================

    Write-Host "`n=== DEMO WORK ORDER VERIFICATION ===" -ForegroundColor Cyan

    $allOrders = @(
        Invoke-FieldOpsApi -Path "/api/work-orders"
    )

    $demoOrders = @(
        $allOrders | Where-Object {
            $_.code -like "DEMO-WO-*"
        }
    )

    if ($demoOrders.Count -ne 24) {
        throw "Unexpected demo work order count: $($demoOrders.Count)"
    }

    foreach ($entry in $plan) {

        $actual = Get-UniqueRecord `
            -Records $demoOrders `
            -Code $entry.Code

        Assert-Order `
            -Actual $actual `
            -Expected $entry.Body

        if ([int]$actual.status -ne $entry.TargetStatus) {
            throw "Unexpected final work order status: $($entry.Code)"
        }

        if (
            [int]$actual.status -in @(2, 3) -and
            [string]::IsNullOrWhiteSpace([string]$actual.startedAtUtc)
        ) {
            throw "Missing start timestamp: $($entry.Code)"
        }

        if (
            [int]$actual.status -eq 3 -and
            [string]::IsNullOrWhiteSpace([string]$actual.completedAtUtc)
        ) {
            throw "Missing completion timestamp: $($entry.Code)"
        }

        if ([int]$actual.status -eq 4) {

            if (
                [string]::IsNullOrWhiteSpace([string]$actual.cancelledAtUtc) -or
                $actual.cancellationReason -cne $entry.Reason
            ) {
                throw "Invalid cancellation details: $($entry.Code)"
            }
        }
    }

    # Preserve and verify non-demo work orders.

    foreach ($previous in $existingOrders) {

        $found = @(
            $allOrders | Where-Object {
                $_.id -eq $previous.id
            }
        )

        if ($found.Count -ne 1) {
            throw "Previously existing work order is missing."
        }

        if ($previous.code -notlike "DEMO-WO-*") {

            if (
                ($found[0] | ConvertTo-Json -Depth 10 -Compress) -cne
                ($previous | ConvertTo-Json -Depth 10 -Compress)
            ) {
                throw "An existing non-demo work order changed."
            }
        }
    }

    Write-Host "`n=== DEMO STATUS DISTRIBUTION ===" -ForegroundColor Cyan

    @(
        foreach ($value in 1..4) {

            $count = @(
                $demoOrders | Where-Object {
                    [int]$_.status -eq $value
                }
            ).Count

            if ($count -ne $expectedStatuses[$value]) {
                throw "Unexpected work order status distribution."
            }

            [PSCustomObject]@{
                Status = $statusNames[$value]
                Records = $count
            }
        }
    ) | Format-Table -AutoSize | Out-Host

    $priorityNames = @{
        1 = "Low"
        2 = "Medium"
        3 = "High"
        4 = "Critical"
    }

    Write-Host "`n=== DEMO PRIORITY DISTRIBUTION ===" -ForegroundColor Cyan

    @(
        foreach ($value in 1..4) {

            $count = @(
                $demoOrders | Where-Object {
                    [int]$_.priority -eq $value
                }
            ).Count

            if ($count -eq 0) {
                throw "Missing work order priority: $value"
            }

            [PSCustomObject]@{
                Priority = $priorityNames[$value]
                Records = $count
            }
        }
    ) | Format-Table -AutoSize | Out-Host

    $linked = @(
        $demoOrders | Where-Object {
            $null -ne $_.incidentId
        }
    ).Count

    $preventive = @(
        $demoOrders | Where-Object {
            $null -eq $_.incidentId
        }
    ).Count

    $unassigned = @(
        $demoOrders | Where-Object {
            [int]$_.status -in @(1, 2) -and
            $null -eq $_.technicianId
        }
    ).Count

    $now = [DateTimeOffset]::UtcNow

    $overdue = @(
        $demoOrders | Where-Object {
            [int]$_.status -in @(1, 2) -and
            $null -ne $_.dueAtUtc -and
            [DateTimeOffset]$_.dueAtUtc -lt $now
        }
    ).Count

    if (
        $linked -ne 20 -or
        $preventive -ne 4 -or
        $unassigned -ne 4
    ) {
        throw "Unexpected operational work order distribution."
    }

    if ($overdue -lt 6) {
        throw "Expected at least six overdue demo work orders."
    }

    Write-Host "`n=== OPERATIONAL INDICATORS ===" -ForegroundColor Cyan

    Write-Host "[INFO] Linked to incidents: $linked"
    Write-Host "[INFO] Independent preventive orders: $preventive"
    Write-Host "[INFO] Active unassigned orders: $unassigned"
    Write-Host "[INFO] Active overdue orders: $overdue"

    Write-Host "`n=== FINAL WORK ORDER COUNTS ===" -ForegroundColor Cyan

    Write-Host "[INFO] Created work orders: $created"
    Write-Host "[INFO] Status transitions: $transitions"
    Write-Host "[INFO] Already complete: $skipped"
    Write-Host "[INFO] Demo work orders: $($demoOrders.Count)"
    Write-Host "[INFO] Total work orders: $($allOrders.Count)"

    Write-Host "[OK] All demo work orders verified."
    Write-Host "[OK] All four work order statuses represented."
    Write-Host "[OK] All four work order priorities represented."
    Write-Host "[OK] Technician assignments verified."
    Write-Host "[OK] Scheduling and due dates verified."
    Write-Host "[OK] Lifecycle timestamps and cancellation reasons verified."
    Write-Host "[OK] Previously existing non-demo work orders preserved."

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

Write-Host "`n[OK] DEMO WORK ORDERS READY." -ForegroundColor Green
