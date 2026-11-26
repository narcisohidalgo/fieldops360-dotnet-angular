param(
    [Parameter(Mandatory = $true)]
    [string]$ReportPath,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 2147483647)]
    [int]$MinimumTests
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
    throw "TRX report does not exist."
}

$fullPath = (Resolve-Path -LiteralPath $ReportPath).ProviderPath

$settings = [System.Xml.XmlReaderSettings]::new()
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$settings.XmlResolver = $null

$document = [System.Xml.XmlDocument]::new()
$document.XmlResolver = $null

$reader = $null

try {
    $reader = [System.Xml.XmlReader]::Create(
        $fullPath, $settings
    )

    $document.Load($reader)
}
catch {
    throw "Invalid TRX XML."
}
finally {
    if ($null -ne $reader) {
        $reader.Dispose()
    }
}

$namespace = "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"

if (
    $document.DocumentElement.LocalName -cne "TestRun" -or
    $document.DocumentElement.NamespaceURI -cne $namespace
) {
    throw "Invalid TRX root or namespace."
}

$manager = [System.Xml.XmlNamespaceManager]::new(
    $document.NameTable
)

$manager.AddNamespace("t", $namespace)

$summaries = $document.SelectNodes(
    "/t:TestRun/t:ResultSummary", $manager
)

if ($summaries.Count -ne 1) {
    throw "Expected exactly one TRX result summary."
}

$summary = $summaries.Item(0)

if ($summary.GetAttribute("outcome") -cnotin @("Completed", "Passed")) {
    throw "Unsuccessful TRX run outcome."
}

$counterNodes = $summary.SelectNodes(
    "t:Counters", $manager
)

if ($counterNodes.Count -ne 1) {
    throw "Expected exactly one TRX counter set."
}

$counters = $counterNodes.Item(0)

function Read-Counter {
    param([string]$Name)

    if (-not $counters.HasAttribute($Name)) {
        throw "Missing TRX counter: $Name"
    }

    $value = $counters.GetAttribute($Name)
    $parsed = 0

    if (
        $value -notmatch '^[0-9]+$' -or
        -not [int]::TryParse($value, [ref]$parsed)
    ) {
        throw "Invalid TRX counter: $Name"
    }

    return $parsed
}

$total = Read-Counter "total"
$executed = Read-Counter "executed"
$passed = Read-Counter "passed"
$failed = Read-Counter "failed"
$notExecuted = Read-Counter "notExecuted"

if ($total -lt $MinimumTests) {
    throw "TRX test count below required minimum."
}

if (
    $executed -ne $total -or
    $passed -ne $total -or
    $failed -ne 0 -or
    $notExecuted -ne 0
) {
    throw "TRX counters indicate unsuccessful or omitted tests."
}

foreach ($name in @(
    "error",
    "timeout",
    "aborted",
    "inconclusive",
    "passedButRunAborted",
    "notRunnable",
    "disconnected",
    "inProgress",
    "pending"
)) {
    if (
        $counters.HasAttribute($name) -and
        (Read-Counter $name) -ne 0
    ) {
        throw "TRX contains an unsuccessful counter: $name"
    }
}

$resultContainers = $document.SelectNodes(
    "/t:TestRun/t:Results", $manager
)

if ($resultContainers.Count -ne 1) {
    throw "Expected exactly one TRX results container."
}

$results = $resultContainers.Item(0).SelectNodes(
    "*", $manager
)

if ($results.Count -ne $total) {
    throw "TRX counters disagree with individual results."
}

$executionIds = [System.Collections.Generic.HashSet[string]]::new()

foreach ($result in $results) {

    if (
        $result.LocalName -cne "UnitTestResult" -or
        $result.NamespaceURI -cne $namespace
    ) {
        throw "Unexpected TRX result type."
    }

    if ($result.GetAttribute("outcome") -cne "Passed") {
        throw "Individual TRX result did not pass."
    }

    $executionId = $result.GetAttribute("executionId")

    $parsedId = [Guid]::Empty

    if (
        -not [Guid]::TryParse($executionId, [ref]$parsedId) -or
        $parsedId -eq [Guid]::Empty
    ) {
        throw "Invalid TRX execution identifier."
    }

    if (-not $executionIds.Add($parsedId.ToString("D"))) {
        throw "Duplicate TRX execution identifier."
    }

    if ([string]::IsNullOrWhiteSpace(
        $result.GetAttribute("testName")
    )) {
        throw "Missing TRX test name."
    }
}

Write-Host (
    "[OK] {0}: total={1}, executed={2}, passed={3}, failed={4}, notExecuted={5}" -f
    [IO.Path]::GetFileName($ReportPath),
    $total,
    $executed,
    $passed,
    $failed,
    $notExecuted
)

Write-Host "[OK] All individual TRX results verified."
