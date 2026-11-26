$ErrorActionPreference = "Stop"

$validator = Join-Path $PSScriptRoot "verify-trx.ps1"

$directory = Join-Path ([IO.Path]::GetTempPath()) (
    "FieldOps360-TrxTests-" + [Guid]::NewGuid().ToString("N")
)

New-Item -ItemType Directory -Path $directory | Out-Null

$base = @"
<?xml version="1.0" encoding="utf-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult executionId="11111111-1111-1111-1111-111111111111" testName="Example test" outcome="Passed" />
    <UnitTestResult executionId="22222222-2222-2222-2222-222222222222" testName="Example test" outcome="Passed" />
  </Results>
  <ResultSummary outcome="Completed">
    <Counters total="2" executed="2" passed="2" failed="0" notExecuted="0" timeout="0" />
  </ResultSummary>
</TestRun>
"@

$cases = @(
    @{
        Name = "Valid report including repeated test names"
        Xml = $base
        ExpectedError = ""
    }
    @{
        Name = "Below required minimum"
        Xml = $base
        Minimum = 3
        ExpectedError = "below required minimum"
    }
    @{
        Name = "Missing report"
        Xml = $null
        ExpectedError = "does not exist"
    }
    @{
        Name = "Malformed XML"
        Xml = "<TestRun"
        ExpectedError = "Invalid TRX XML"
    }
    @{
        Name = "Missing required counter"
        Xml = $base.Replace(' notExecuted="0"', '')
        ExpectedError = "Missing TRX counter"
    }
    @{
        Name = "Failed test counter"
        Xml = $base.Replace('failed="0"', 'failed="1"')
        ExpectedError = "unsuccessful or omitted"
    }
    @{
        Name = "Skipped test counter"
        Xml = $base.Replace('notExecuted="0"', 'notExecuted="1"')
        ExpectedError = "unsuccessful or omitted"
    }
    @{
        Name = "Counter and result mismatch"
        Xml = $base.Replace(
            'total="2" executed="2" passed="2"',
            'total="3" executed="3" passed="3"'
        )
        ExpectedError = "disagree with individual results"
    }
    @{
        Name = "Individual failed result"
        Xml = $base.Replace('outcome="Passed"', 'outcome="Failed"')
        ExpectedError = "Individual TRX result did not pass"
    }
    @{
        Name = "Duplicate execution identifier"
        Xml = $base.Replace(
            '22222222-2222-2222-2222-222222222222',
            '11111111-1111-1111-1111-111111111111'
        )
        ExpectedError = "Duplicate TRX execution identifier"
    }
    @{
        Name = "Unsuccessful run outcome"
        Xml = $base.Replace('outcome="Completed"', 'outcome="Failed"')
        ExpectedError = "Unsuccessful TRX run outcome"
    }
    @{
        Name = "Missing results container"
        Xml = [regex]::Replace(
            $base,
            '(?s)<Results>.*?</Results>',
            ''
        )
        ExpectedError = "Expected exactly one TRX results container"
    }
    @{
        Name = "Prohibited XML document type"
        Xml = $base.Replace(
            '<TestRun xmlns=',
            '<!DOCTYPE TestRun []><TestRun xmlns='
        )
        ExpectedError = "Invalid TRX XML"
    }
    @{
        Name = "Invalid numeric counter"
        Xml = $base.Replace('total="2"', 'total="invalid"')
        ExpectedError = "Invalid TRX counter"
    }
)

$passed = 0

try {
    for ($i = 0; $i -lt $cases.Count; $i++) {

        $case = $cases[$i]
        $path = Join-Path $directory "case-$i.trx"

        if ($null -ne $case.Xml) {
            [IO.File]::WriteAllText(
                $path,
                $case.Xml,
                [Text.UTF8Encoding]::new($false)
            )
        }

        $minimum = 2

        if ($case.ContainsKey("Minimum")) {
            $minimum = $case.Minimum
        }

        $failure = ""

        try {
            & $validator `
                -ReportPath $path `
                -MinimumTests $minimum
        }
        catch {
            $failure = $_.Exception.Message
        }

        if ([string]::IsNullOrEmpty($case.ExpectedError)) {

            if (-not [string]::IsNullOrEmpty($failure)) {
                throw "Positive test failed: $($case.Name): $failure"
            }
        }
        else {
            if (-not $failure.Contains($case.ExpectedError)) {
                throw "Unexpected regression result: $($case.Name): $failure"
            }
        }

        $passed++

        Write-Host "[PASS] $($case.Name)" -ForegroundColor Green
    }

    if ($passed -ne 14) {
        throw "Unexpected TRX regression test count."
    }

    Write-Host "[OK] All 14 TRX validator regression tests passed."
}
finally {
    Remove-Item -LiteralPath $directory -Recurse -Force
}
