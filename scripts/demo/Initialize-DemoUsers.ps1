[CmdletBinding()]
param(
    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

$root = [IO.Path]::GetFullPath(
    (Join-Path (Join-Path $PSScriptRoot "..") "..")
)

Push-Location $root

$baseUrl = "https://localhost:8443"
$adminSession = $null
$demoSession = $null
$adminPassword = $null
$demoPassword = $null

function Invoke-FieldOpsApi {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [object]$Session,

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
        WebSession = $Session
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

function Open-FieldOpsSession {
    param(
        [string]$Email,
        [System.Security.SecureString]$Password
    )

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    $tokenResponse = Invoke-FieldOpsApi `
        -Path "/api/auth/csrf" `
        -Session $session

    if ([string]::IsNullOrWhiteSpace($tokenResponse.requestToken)) {
        throw "Missing anonymous CSRF token."
    }

    $credential = New-Object System.Management.Automation.PSCredential(
        $Email,
        $Password
    )

    $body = @{
        email = $Email
        password = $credential.GetNetworkCredential().Password
    }

    try {

        Invoke-FieldOpsApi `
            -Path "/api/auth/login" `
            -Session $session `
            -Method "POST" `
            -Body $body `
            -Token $tokenResponse.requestToken | Out-Null
    }
    finally {

        $body.Clear()

        Remove-Variable body, credential `
            -ErrorAction SilentlyContinue
    }

    return $session
}

function Close-FieldOpsSession {
    param(
        [object]$Session
    )

    if ($null -eq $Session) {
        return
    }

    try {

        $tokenResponse = Invoke-FieldOpsApi `
            -Path "/api/auth/csrf" `
            -Session $Session

        Invoke-FieldOpsApi `
            -Path "/api/auth/logout" `
            -Session $Session `
            -Method "POST" `
            -Token $tokenResponse.requestToken | Out-Null
    }
    catch {
        Write-Warning "Unable to confirm API logout."
    }
}

function Assert-HttpStatus {
    param(
        [string]$Path,
        [object]$Session,
        [int]$ExpectedStatus
    )

    $actualStatus = 200

    try {

        Invoke-FieldOpsApi `
            -Path $Path `
            -Session $Session | Out-Null
    }
    catch {

        if ($null -eq $_.Exception.Response) {
            throw
        }

        $actualStatus = [int]$_.Exception.Response.StatusCode
    }

    if ($actualStatus -ne $ExpectedStatus) {
        throw "Unexpected HTTP status for $Path. Expected $ExpectedStatus, received $actualStatus."
    }

    Write-Host "[OK] HTTP $actualStatus - $Path"
}

function Assert-DemoUser {
    param(
        [object]$Actual,
        [object]$Expected
    )

    foreach ($field in @(
        "email",
        "displayName",
        "technicianId"
    )) {

        if (
            [string]$Actual.$field -cne
            [string]$Expected.$field
        ) {
            throw "Existing user mismatch: $($Expected.email), field $field."
        }
    }

    if (
        -not $Actual.isActive -or
        @($Actual.roles).Count -ne 1 -or
        $Actual.roles -notcontains $Expected.role
    ) {
        throw "Unexpected user role or activation state: $($Expected.email)"
    }

    if ([string]::IsNullOrWhiteSpace([string]$Actual.id)) {
        throw "Missing user identifier."
    }
}

try {

    # ============================================================
    # 1. VERIFY LOCAL DOCKER ENVIRONMENT
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

    $anonymousSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    $status = Invoke-FieldOpsApi `
        -Path "/api/system/status" `
        -Session $anonymousSession

    if (
        $status.application -ne "FieldOps 360" -or
        $status.status -ne "online"
    ) {
        throw "Unexpected application status."
    }

    Write-Host "[OK] Local Docker environment verified."
    Write-Host "[OK] HTTPS API available."

    # ============================================================
    # 2. ADMINISTRATOR AUTHENTICATION
    # ============================================================

    Write-Host "`n=== ADMINISTRATOR AUTHENTICATION ===" -ForegroundColor Cyan

    $adminEmail = (Read-Host "Administrator email").Trim()

    if ([string]::IsNullOrWhiteSpace($adminEmail)) {
        throw "Administrator email is required."
    }

    $adminPassword = Read-Host "Administrator password" -AsSecureString

    try {

        $adminSession = Open-FieldOpsSession `
            -Email $adminEmail `
            -Password $adminPassword
    }
    finally {

        $adminPassword.Dispose()
        $adminPassword = $null
    }

    $admin = Invoke-FieldOpsApi `
        -Path "/api/auth/me" `
        -Session $adminSession

    if ($admin.roles -notcontains "Administrator") {
        throw "Administrator permissions are required."
    }

    $csrfResponse = Invoke-FieldOpsApi `
        -Path "/api/auth/csrf" `
        -Session $adminSession

    $adminCsrf = $csrfResponse.requestToken

    if ([string]::IsNullOrWhiteSpace($adminCsrf)) {
        throw "Missing authenticated CSRF token."
    }

    Write-Host "[OK] Administrator authenticated."

    # ============================================================
    # 3. VERIFY REFERENCE DATA
    # ============================================================

    Write-Host "`n=== DEMO USER PREFLIGHT ===" -ForegroundColor Cyan

    $technicians = @(
        Invoke-FieldOpsApi `
            -Path "/api/technicians" `
            -Session $adminSession
    )

    $orders = @(
        Invoke-FieldOpsApi `
            -Path "/api/work-orders" `
            -Session $adminSession
    )

    $existingUsers = @(
        Invoke-FieldOpsApi `
            -Path "/api/users" `
            -Session $adminSession
    )

    $foundTechnician = @(
        $technicians | Where-Object {
            $_.code -eq "DEMO-TEC-001"
        }
    )

    if ($foundTechnician.Count -ne 1) {
        throw "Expected exactly one DEMO-TEC-001 technician."
    }

    $technician = $foundTechnician[0]

    if (
        -not $technician.isActive -or
        $technician.email -ne "technician01@fieldops.example"
    ) {
        throw "Unexpected demo technician details."
    }

    $ownOrders = @(
        $orders | Where-Object {
            $_.technicianId -eq $technician.id
        }
    )

    $expectedCodes = @(
        "DEMO-WO-001",
        "DEMO-WO-004",
        "DEMO-WO-014"
    )

    $ownDemoOrders = @(
        $ownOrders | Where-Object {
            $_.code -like "DEMO-WO-*"
        }
    )

    if ($ownDemoOrders.Count -ne 3) {
        throw "Expected three assigned demo work orders."
    }

    foreach ($code in $expectedCodes) {

        if ($ownDemoOrders.code -notcontains $code) {
            throw "Expected assigned work order missing: $code"
        }
    }

    $foreignOrders = @(
        $orders | Where-Object {
            $_.code -eq "DEMO-WO-002" -and
            $_.technicianId -ne $technician.id
        }
    )

    if ($foreignOrders.Count -ne 1) {
        throw "Expected one foreign work order."
    }

    $foreignOrderId = $foreignOrders[0].id

    Write-Host "[OK] Active technician DEMO-TEC-001."
    Write-Host "[OK] Three assigned demo work orders."
    Write-Host "[OK] Foreign work order available for isolation check."

    # ============================================================
    # 4. DEFINE AND PREFLIGHT DEMO USERS
    # ============================================================

    $definitions = @(
        [PSCustomObject]@{
            email = "supervisor@fieldops.example"
            displayName = "Supervisor Demo"
            role = "Supervisor"
            technicianId = $null
        }

        [PSCustomObject]@{
            email = "technician01@fieldops.example"
            displayName = "Alejandro Demo"
            role = "Technician"
            technicianId = $technician.id
        }
    )

    $plan = @(

        foreach ($definition in $definitions) {

            $found = @(
                $existingUsers | Where-Object {
                    $_.email -eq $definition.email
                }
            )

            if ($found.Count -gt 1) {
                throw "Duplicate user email: $($definition.email)"
            }

            $existing = $null

            if ($found.Count -eq 1) {

                $existing = $found[0]

                Assert-DemoUser `
                    -Actual $existing `
                    -Expected $definition
            }
            elseif ($VerifyOnly) {

                throw "Verification-only mode: missing $($definition.email)"
            }

            if ($definition.role -eq "Technician") {

                $conflicts = @(
                    $existingUsers | Where-Object {
                        $_.technicianId -eq $definition.technicianId -and
                        $_.email -ne $definition.email
                    }
                )

                if ($conflicts.Count -gt 0) {
                    throw "Demo technician is linked to another user."
                }
            }

            [PSCustomObject]@{
                Definition = $definition
                Existing = $existing
            }
        }
    )

    Write-Host "[OK] User email and role conflicts checked."
    Write-Host "[OK] Technician association verified."

    # ============================================================
    # 5. CREATE USERS AND VERIFY THEIR ACCESS
    # ============================================================

    $created = 0
    $skipped = 0

    foreach ($entry in $plan) {

        $definition = $entry.Definition

        Write-Host "`n=== ROLE: $($definition.role) ===" -ForegroundColor Cyan

        Write-Host "Email: $($definition.email)"

        if ($null -eq $entry.Existing) {

            $demoPassword = Read-Host `
                "Choose a new password for this demo user" `
                -AsSecureString

            $credential = New-Object System.Management.Automation.PSCredential(
                $definition.email,
                $demoPassword
            )

            $body = @{
                email = $definition.email
                displayName = $definition.displayName
                role = $definition.role
                technicianId = $definition.technicianId
                password = $credential.GetNetworkCredential().Password
            }

            try {

                $user = Invoke-FieldOpsApi `
                    -Path "/api/users" `
                    -Session $adminSession `
                    -Method "POST" `
                    -Body $body `
                    -Token $adminCsrf

                Assert-DemoUser `
                    -Actual $user `
                    -Expected $definition

                $created++

                Write-Host "[CREATED] $($definition.email)"
            }
            finally {

                $body.Clear()

                Remove-Variable body, credential `
                    -ErrorAction SilentlyContinue
            }
        }
        else {

            $skipped++

            Write-Host "[SKIP] User already exists."

            $demoPassword = Read-Host `
                "Enter the existing demo user password" `
                -AsSecureString
        }

        try {

            $demoSession = Open-FieldOpsSession `
                -Email $definition.email `
                -Password $demoPassword
        }
        finally {

            $demoPassword.Dispose()
            $demoPassword = $null
        }

        try {

            $identity = Invoke-FieldOpsApi `
                -Path "/api/auth/me" `
                -Session $demoSession

            if (
                @($identity.roles).Count -ne 1 -or
                $identity.roles -notcontains $definition.role -or
                [string]$identity.technicianId -ne
                    [string]$definition.technicianId
            ) {
                throw "Unexpected authenticated user identity."
            }

            Write-Host "[OK] $($definition.role) authenticated."

            Assert-HttpStatus `
                -Path "/api/users" `
                -Session $demoSession `
                -ExpectedStatus 403

            Assert-HttpStatus `
                -Path "/api/facilities" `
                -Session $demoSession `
                -ExpectedStatus 200

            if ($definition.role -eq "Supervisor") {

                Assert-HttpStatus `
                    -Path "/api/incidents" `
                    -Session $demoSession `
                    -ExpectedStatus 200

                Assert-HttpStatus `
                    -Path "/api/work-orders" `
                    -Session $demoSession `
                    -ExpectedStatus 200

                Write-Host "[OK] Supervisor operational access."
            }

            if ($definition.role -eq "Technician") {

                Assert-HttpStatus `
                    -Path "/api/work-orders" `
                    -Session $demoSession `
                    -ExpectedStatus 403

                Assert-HttpStatus `
                    -Path "/api/incidents" `
                    -Session $demoSession `
                    -ExpectedStatus 403

                $visibleOrders = @(
                    Invoke-FieldOpsApi `
                        -Path "/api/my/work-orders" `
                        -Session $demoSession
                )

                if ($visibleOrders.Count -ne $ownOrders.Count) {
                    throw "Unexpected number of technician work orders."
                }

                foreach ($order in $visibleOrders) {

                    if (
                        $order.technicianId -ne $technician.id -or
                        $ownOrders.id -notcontains $order.id
                    ) {
                        throw "Technician can access a foreign order."
                    }
                }

                foreach ($code in $expectedCodes) {

                    if ($visibleOrders.code -notcontains $code) {
                        throw "Assigned demo work order missing: $code"
                    }
                }

                Assert-HttpStatus `
                    -Path "/api/my/work-orders/$foreignOrderId" `
                    -Session $demoSession `
                    -ExpectedStatus 404

                Write-Host "[OK] Technician can access assigned work orders only."

                $visibleOrders |
                    Select-Object code, title, status |
                    Format-Table -AutoSize |
                    Out-Host
            }
        }
        finally {

            Close-FieldOpsSession -Session $demoSession
            $demoSession = $null
        }
    }

    # ============================================================
    # 6. CONSOLIDATED USER VERIFICATION
    # ============================================================

    Write-Host "`n=== USER VERIFICATION ===" -ForegroundColor Cyan

    $allUsers = @(
        Invoke-FieldOpsApi `
            -Path "/api/users" `
            -Session $adminSession
    )

    foreach ($definition in $definitions) {

        $found = @(
            $allUsers | Where-Object {
                $_.email -eq $definition.email
            }
        )

        if ($found.Count -ne 1) {
            throw "Unexpected final user count."
        }

        Assert-DemoUser `
            -Actual $found[0] `
            -Expected $definition
    }

    foreach ($previous in $existingUsers) {

        $found = @(
            $allUsers | Where-Object {
                $_.id -eq $previous.id
            }
        )

        if ($found.Count -ne 1) {
            throw "Previously existing user is missing."
        }

        foreach ($field in @(
            "email",
            "displayName",
            "isActive",
            "technicianId"
        )) {

            if (
                [string]$found[0].$field -cne
                [string]$previous.$field
            ) {
                throw "Previously existing user changed."
            }
        }

        if (
            (($found[0].roles | Sort-Object) -join ",") -cne
            (($previous.roles | Sort-Object) -join ",")
        ) {
            throw "Previously existing user roles changed."
        }
    }

    if ($allUsers.Count -ne ($existingUsers.Count + $created)) {
        throw "Unexpected final total user count."
    }

    if ($VerifyOnly -and $created -ne 0) {
        throw "Unexpected user creation in verification-only mode."
    }

    $allUsers |
        Select-Object email, displayName, isActive,
            @{Name = "Roles"; Expression = {
                $_.roles -join ", "
            }} |
        Format-Table -AutoSize |
        Out-Host

    Write-Host "[INFO] Created demo users: $created"
    Write-Host "[INFO] Existing demo users: $skipped"
    Write-Host "[INFO] Total users: $($allUsers.Count)"

    Write-Host "[OK] Administrator preserved."
    Write-Host "[OK] Supervisor verified."
    Write-Host "[OK] Technician verified."
    Write-Host "[OK] Role-based authorization verified."
    Write-Host "[OK] Technician work order isolation verified."
    Write-Host "[OK] Existing user details and roles preserved."
}
finally {

    Close-FieldOpsSession -Session $demoSession
    Close-FieldOpsSession -Session $adminSession

    if ($null -ne $adminPassword) {
        $adminPassword.Dispose()
    }

    if ($null -ne $demoPassword) {
        $demoPassword.Dispose()
    }

    Remove-Variable adminSession, demoSession, adminCsrf,
        adminPassword, demoPassword, sql, inspection,
        inspectionOutput -ErrorAction SilentlyContinue

    Pop-Location
}

Write-Host "`n[OK] DEMO USERS READY." -ForegroundColor Green
