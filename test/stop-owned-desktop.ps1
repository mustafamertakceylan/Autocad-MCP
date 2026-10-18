param([Parameter(Mandatory=$true)][string]$Configuration)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $Configuration | ConvertFrom-Json
$root = [System.IO.Path]::GetFullPath($config.root)
if ([System.IO.Path]::GetDirectoryName($root) -ne (Join-Path (Get-Location) 'tmp\desktop-runs') -or
    [System.IO.Path]::GetFileName($root) -notmatch '^[a-f0-9-]{36}$') { throw 'Unsafe test process root' }
$testProcessId = [int]$config.pid
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$testProcessId"
if (-not $process) { exit 0 }
if ($process.Name -ne 'acad.exe' -or -not $process.CommandLine.Contains($root)) { throw 'Process is not the owned synthetic test' }
# Caller must verify all open drawings using the fixed assert_owned native test action.
Stop-Process -Id $testProcessId -Force
