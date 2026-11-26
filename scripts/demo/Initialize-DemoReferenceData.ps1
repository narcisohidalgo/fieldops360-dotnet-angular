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
$credential = $null
$authenticated = $false
$csrf = $null

try {
    $baseUrl = "https://localhost:8443"

    function Invoke-FieldOpsApi {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Path,

            [string]$Method = "GET",

            [object]$Body,

            [string]$Token
        )

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

        if (
            $VerifyOnly -and
            $Method -ne "GET" -and
            $Path -notin @(
                "/api/auth/login",
                "/api/auth/logout"
            )
        ) {
            throw "Verification-only mode blocked a write request: $Method $Path"
        }

        $response = Invoke-RestMethod @parameters

        # Explicitly enumerate JSON collections for
        # Windows PowerShell 5.1 compatibility.

        foreach ($item in $response) {
            if ($null -ne $item) {
                Write-Output $item
            }
        }
    }

    function Assert-Record {
        param(
            [object]$Actual,
            [object]$Expected,
            [string[]]$Fields
        )

        if (
            $Actual.isActive -isnot [bool] -or
            -not $Actual.isActive
        ) {
            throw "Existing demo record is inactive or has an invalid active state: $($Expected.code). No overwrite performed."
        }

        foreach ($field in $Fields) {

            if (
                [string]$Actual.$field -cne
                [string]$Expected.$field
            ) {
                throw "Existing demo record differs: $($Expected.code), field $field. No overwrite performed."
            }
        }
    }

    # ============================================================
    # 1. VERIFY THE LOCAL DOCKER ENVIRONMENT
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
        throw "Unable to inspect the SQL Server container."
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

    $dataVolume = @(
        $sql.Mounts | Where-Object {
            $_.Name -eq "fieldops360_sqlserver-data" -and
            $_.Destination -eq "/var/opt/mssql"
        }
    )

    if ($dataVolume.Count -ne 1) {
        throw "Unexpected SQL data volume."
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
    # 2. AUTHENTICATE USING THE EXISTING ADMINISTRATOR
    # ============================================================

    Write-Host "`n=== ADMINISTRATOR AUTHENTICATION ===" -ForegroundColor Cyan

    $email = Read-Host "Administrator email"

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
        $login = Invoke-FieldOpsApi `
            -Path "/api/auth/login" `
            -Method "POST" `
            -Body $loginBody `
            -Token $anonymousCsrf.requestToken

        $authenticated = $true
    }
    finally {
        $loginBody.Clear()

        Remove-Variable loginBody, credential, securePassword `
            -ErrorAction SilentlyContinue
    }

    $authenticatedCsrf = Invoke-FieldOpsApi -Path "/api/auth/csrf"
    $csrf = $authenticatedCsrf.requestToken

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
    # 3. DEFINE FICTIONAL DEMONSTRATION DATA
    # ============================================================

    # ASCII JSON escapes keep the script compatible
    # with Windows PowerShell 5.1 and UTF-8 without BOM.

    $facilities = @"
[
  {
    "code":"DEMO-FAC-001",
    "name":"Centro log\u00edstico Madrid",
    "city":"Madrid",
    "address":"Sector log\u00edstico demo A",
    "latitude":40.416800,
    "longitude":-3.703800
  },
  {
    "code":"DEMO-FAC-002",
    "name":"Planta industrial Barcelona",
    "city":"Barcelona",
    "address":"Sector industrial demo B",
    "latitude":41.387400,
    "longitude":2.168600
  },
  {
    "code":"DEMO-FAC-003",
    "name":"Centro de distribuci\u00f3n Valencia",
    "city":"Valencia",
    "address":"Sector log\u00edstico demo C",
    "latitude":39.469900,
    "longitude":-0.376300
  },
  {
    "code":"DEMO-FAC-004",
    "name":"Planta de mantenimiento Sevilla",
    "city":"Sevilla",
    "address":"Sector industrial demo D",
    "latitude":37.389100,
    "longitude":-5.984500
  },
  {
    "code":"DEMO-FAC-005",
    "name":"Complejo industrial Bilbao",
    "city":"Bilbao",
    "address":"Sector industrial demo E",
    "latitude":43.263000,
    "longitude":-2.935000
  },
  {
    "code":"DEMO-FAC-006",
    "name":"Centro tecnol\u00f3gico M\u00e1laga",
    "city":"M\u00e1laga",
    "address":"Sector tecnol\u00f3gico demo F",
    "latitude":36.721300,
    "longitude":-4.421400
  },
  {
    "code":"DEMO-FAC-007",
    "name":"Plataforma log\u00edstica Zaragoza",
    "city":"Zaragoza",
    "address":"Sector log\u00edstico demo G",
    "latitude":41.648800,
    "longitude":-0.889100
  },
  {
    "code":"DEMO-FAC-008",
    "name":"Planta de producci\u00f3n Valladolid",
    "city":"Valladolid",
    "address":"Sector industrial demo H",
    "latitude":41.652300,
    "longitude":-4.724500
  }
]
"@ | ConvertFrom-Json

    $assetGroups = @"
[
  [
    "Cinta transportadora CT-01",
    "Carretilla elevadora CE-02",
    "Sistema de climatizaci\u00f3n HVAC-03"
  ],
  [
    "Compresor industrial CI-01",
    "Motor el\u00e9ctrico ME-02",
    "Cuadro el\u00e9ctrico QE-03"
  ],
  [
    "Muelle de carga MC-01",
    "Sistema de refrigeraci\u00f3n SR-02",
    "Bomba hidr\u00e1ulica BH-03"
  ],
  [
    "Generador auxiliar GA-01",
    "Equipo de soldadura ES-02",
    "Sistema de ventilaci\u00f3n SV-03"
  ],
  [
    "Prensa hidr\u00e1ulica PH-01",
    "Motor de producci\u00f3n MP-02",
    "Sensor de vibraciones SV-03"
  ],
  [
    "Servidor de operaciones SO-01",
    "Sistema de alimentaci\u00f3n SAI-02",
    "Unidad de climatizaci\u00f3n UC-03"
  ],
  [
    "Clasificador autom\u00e1tico CA-01",
    "Transportador de rodillos TR-02",
    "Puerta industrial PI-03"
  ],
  [
    "L\u00ednea de ensamblaje LE-01",
    "Robot industrial RI-02",
    "Sistema neum\u00e1tico SN-03"
  ]
]
"@ | ConvertFrom-Json

    $technicians = @"
[
  {"name":"Alejandro Demo","specialty":"Mantenimiento mec\u00e1nico"},
  {"name":"Luc\u00eda Demo","specialty":"Electricidad industrial"},
  {"name":"Daniel Demo","specialty":"Automatizaci\u00f3n y control"},
  {"name":"Marta Demo","specialty":"Climatizaci\u00f3n y refrigeraci\u00f3n"},
  {"name":"Pablo Demo","specialty":"Sistemas hidr\u00e1ulicos"},
  {"name":"Elena Demo","specialty":"Sistemas inform\u00e1ticos"},
  {"name":"Sergio Demo","specialty":"Mantenimiento preventivo"},
  {"name":"Laura Demo","specialty":"Rob\u00f3tica industrial"}
]
"@ | ConvertFrom-Json

    if (
        $facilities.Count -ne 8 -or
        $assetGroups.Count -ne 8 -or
        $technicians.Count -ne 8
    ) {
        throw "Unexpected demo data definition."
    }

    # ============================================================
    # 4. LOAD EXISTING RECORDS
    # ============================================================

    $existingFacilities = @(
        Invoke-FieldOpsApi -Path "/api/facilities"
    )

    $existingAssets = @(
        Invoke-FieldOpsApi -Path "/api/assets"
    )

    $existingTechnicians = @(
        Invoke-FieldOpsApi -Path "/api/technicians"
    )

    $facilityIds = @{}

    $createdFacilities = 0
    $createdAssets = 0
    $createdTechnicians = 0

    # ============================================================
    # 5. CREATE FACILITIES
    # ============================================================

    Write-Host "`n=== DEMO FACILITIES ===" -ForegroundColor Cyan

    foreach ($definition in $facilities) {

        $matches = @(
            $existingFacilities | Where-Object {
                $_.code -eq $definition.code
            }
        )

        if ($matches.Count -gt 1) {
            throw "Duplicate facility code: $($definition.code)"
        }

        if ($matches.Count -eq 1) {

            $facility = $matches[0]

            Assert-Record `
                -Actual $facility `
                -Expected $definition `
                -Fields @(
                    "code", "name", "city", "address",
                    "latitude", "longitude"
                )

            Write-Host "[SKIP] $($definition.code) already exists."
        }
        else {

            $facility = Invoke-FieldOpsApi `
                -Path "/api/facilities" `
                -Method "POST" `
                -Body $definition `
                -Token $csrf

            $createdFacilities++

            Write-Host "[CREATED] $($facility.code) - $($facility.name)"
        }

        if ([string]::IsNullOrWhiteSpace($facility.id)) {
            throw "Facility ID missing."
        }

        $facilityIds[$definition.code] = $facility.id
    }

    # ============================================================
    # 6. CREATE ASSETS
    # ============================================================

    Write-Host "`n=== DEMO ASSETS ===" -ForegroundColor Cyan

    for ($i = 0; $i -lt $facilities.Count; $i++) {

        $facilityCode = $facilities[$i].code

        if (@($assetGroups[$i]).Count -ne 3) {
            throw "Unexpected asset definition: $facilityCode"
        }

        for ($j = 0; $j -lt 3; $j++) {

            $assetNumber = ($i * 3) + $j + 1
            $code = "DEMO-AST-{0:D3}" -f $assetNumber

            $definition = [PSCustomObject]@{
                facilityId = $facilityIds[$facilityCode]
                code = $code
                name = $assetGroups[$i][$j]
                description = "Equipo ficticio para demostracion de operaciones y mantenimiento."
            }

            $matches = @(
                $existingAssets | Where-Object {
                    $_.code -eq $code
                }
            )

            if ($matches.Count -gt 1) {
                throw "Duplicate asset code: $code"
            }

            if ($matches.Count -eq 1) {

                Assert-Record `
                    -Actual $matches[0] `
                    -Expected $definition `
                    -Fields @(
                        "code", "facilityId", "name", "description"
                    )

                Write-Host "[SKIP] $code already exists."
            }
            else {

                $asset = Invoke-FieldOpsApi `
                    -Path "/api/assets" `
                    -Method "POST" `
                    -Body $definition `
                    -Token $csrf

                $createdAssets++

                Write-Host "[CREATED] $($asset.code) - $($asset.name)"
            }
        }
    }

    # ============================================================
    # 7. CREATE TECHNICIANS
    # ============================================================

    Write-Host "`n=== DEMO TECHNICIANS ===" -ForegroundColor Cyan

    for ($i = 0; $i -lt $technicians.Count; $i++) {

        $number = $i + 1
        $code = "DEMO-TEC-{0:D3}" -f $number

        $definition = [PSCustomObject]@{
            code = $code
            name = $technicians[$i].name
            email = "technician{0:D2}@fieldops.example" -f $number
            phone = $null
            specialty = $technicians[$i].specialty
        }

        $matches = @(
            $existingTechnicians | Where-Object {
                $_.code -eq $code
            }
        )

        if ($matches.Count -gt 1) {
            throw "Duplicate technician code: $code"
        }

        if ($matches.Count -eq 1) {

            Assert-Record `
                -Actual $matches[0] `
                -Expected $definition `
                -Fields @(
                    "code", "name", "email", "phone", "specialty"
                )

            Write-Host "[SKIP] $code already exists."
        }
        else {

            $technician = Invoke-FieldOpsApi `
                -Path "/api/technicians" `
                -Method "POST" `
                -Body $definition `
                -Token $csrf

            $createdTechnicians++

            Write-Host "[CREATED] $($technician.code) - $($technician.name)"
        }
    }

    # ============================================================
    # 8. VERIFY THE RESULT THROUGH THE API
    # ============================================================

    Write-Host "`n=== DEMO DATA VERIFICATION ===" -ForegroundColor Cyan

    $allFacilities = @(
        Invoke-FieldOpsApi -Path "/api/facilities"
    )

    $allAssets = @(
        Invoke-FieldOpsApi -Path "/api/assets"
    )

    $allTechnicians = @(
        Invoke-FieldOpsApi -Path "/api/technicians"
    )

    $demoFacilities = @(
        $allFacilities | Where-Object {
            $_.code -like "DEMO-FAC-*"
        }
    )

    $demoAssets = @(
        $allAssets | Where-Object {
            $_.code -like "DEMO-AST-*"
        }
    )

    $demoTechnicians = @(
        $allTechnicians | Where-Object {
            $_.code -like "DEMO-TEC-*"
        }
    )

    if (
        $demoFacilities.Count -ne 8 -or
        $demoAssets.Count -ne 24 -or
        $demoTechnicians.Count -ne 8
    ) {
        Write-Host "[INFO] Demo facilities: $($demoFacilities.Count) / 8"
        Write-Host "[INFO] Demo assets: $($demoAssets.Count) / 24"
        Write-Host "[INFO] Demo technicians: $($demoTechnicians.Count) / 8"

        Write-Host "[INFO] Total facilities: $($allFacilities.Count)"
        Write-Host "[INFO] Total assets: $($allAssets.Count)"
        Write-Host "[INFO] Total technicians: $($allTechnicians.Count)"

        throw "Unexpected demo reference data counts."
    }

    $allDemoRecords = @(
        $demoFacilities + $demoAssets + $demoTechnicians
    )

    foreach ($record in $allDemoRecords) {

        if (
            $record.isActive -isnot [bool] -or
            -not $record.isActive
        ) {
            throw "Demo reference record is inactive or has an invalid active state: $($record.code)"
        }
    }

    Write-Host "[OK] All forty demo reference records are active."

    foreach ($facility in $demoFacilities) {

        $associatedAssets = @(
            $demoAssets | Where-Object {
                $_.facilityId -eq $facility.id
            }
        )

        if ($associatedAssets.Count -ne 3) {
            throw "Unexpected asset count: $($facility.code)"
        }

        if (
            $null -eq $facility.latitude -or
            $null -eq $facility.longitude
        ) {
            throw "Demo facility coordinates are missing."
        }
    }

    # Verify that previously existing non-demo IDs remain.

    foreach ($facility in $existingFacilities) {

        if ($allFacilities.id -notcontains $facility.id) {
            throw "Previously existing facility is missing."
        }
    }

    foreach ($asset in $existingAssets) {

        if ($allAssets.id -notcontains $asset.id) {
            throw "Previously existing asset is missing."
        }
    }

    foreach ($technician in $existingTechnicians) {

        if ($allTechnicians.id -notcontains $technician.id) {
            throw "Previously existing technician is missing."
        }
    }

    @(
        [PSCustomObject]@{
            Entity = "Facilities"
            Created = $createdFacilities
            Demo = $demoFacilities.Count
            Total = $allFacilities.Count
        }
        [PSCustomObject]@{
            Entity = "Assets"
            Created = $createdAssets
            Demo = $demoAssets.Count
            Total = $allAssets.Count
        }
        [PSCustomObject]@{
            Entity = "Technicians"
            Created = $createdTechnicians
            Demo = $demoTechnicians.Count
            Total = $allTechnicians.Count
        }
    ) | Format-Table -AutoSize | Out-Host

    Write-Host "[OK] Eight geolocated demo facilities."
    Write-Host "[OK] Twenty-four demo assets."
    Write-Host "[OK] Three assets per demo facility."
    Write-Host "[OK] Eight demo technicians."
    Write-Host "[OK] Previously existing records preserved."
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

Write-Host "`n[OK] DEMO REFERENCE DATA READY." -ForegroundColor Green
