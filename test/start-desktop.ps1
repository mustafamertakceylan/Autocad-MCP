param(
    [Parameter(Mandatory=$true)][string]$TestRoot,
    [Parameter(Mandatory=$true)][string]$AutoCADRoot,
    [Parameter(Mandatory=$true)][string]$Template,
    [Parameter(Mandatory=$true)][string]$Plugin
)
$ErrorActionPreference = 'Stop'
$absoluteRoot = [System.IO.Path]::GetFullPath($TestRoot)
$expectedParent = Join-Path (Get-Location) 'tmp\desktop-runs'
if ([System.IO.Path]::GetDirectoryName($absoluteRoot) -ne $expectedParent -or
    [System.IO.Path]::GetFileName($absoluteRoot) -notmatch '^[a-f0-9-]{36}$') { throw 'Unsafe desktop test root' }
if (Get-Process acad -ErrorAction SilentlyContinue) { throw 'Close existing AutoCAD before isolated desktop acceptance; no existing session is used' }
New-Item -ItemType Directory -Path (Join-Path $absoluteRoot 'runtime') -Force | Out-Null
$profileName = 'AutocadMcpDesktop-' + [guid]::NewGuid().ToString('N')
$profilesRoot = 'HKCU:\Software\Autodesk\AutoCAD\R26.0\ACAD-A101:409\Profiles'
$sourceProfile = Join-Path $profilesRoot '<<Unnamed Profile>>'
$targetProfile = Join-Path $profilesRoot $profileName
if (Test-Path -LiteralPath $targetProfile) { throw 'Test profile already exists' }
Copy-Item -LiteralPath $sourceProfile -Destination $targetProfile -Recurse
# Trust only our compiled module directory in this new test profile; keep SECURELOAD=2.
Set-ItemProperty -LiteralPath (Join-Path $targetProfile 'Variables') -Name TRUSTEDPATHS -Value ([System.IO.Path]::GetDirectoryName($Plugin))
Set-ItemProperty -LiteralPath (Join-Path $targetProfile 'Variables') -Name SECURELOAD -Value 2
Set-ItemProperty -LiteralPath (Join-Path $targetProfile 'General') -Name ACADLOGFILE -Value (Join-Path $absoluteRoot 'desktop.log')
Copy-Item -LiteralPath $Template -Destination (Join-Path $absoluteRoot 'primary.dwg')
Copy-Item -LiteralPath $Template -Destination (Join-Path $absoluteRoot 'secondary.dwg')
$moduleSlash = $Plugin.Replace('\','/')
$rootSlash = $absoluteRoot.Replace('\','/') + '/'
$script = @"
(setvar "FILEDIA" 0)
(setvar "CMDECHO" 0)
(setvar "INSUNITS" 4)
(setvar "LOGFILEPATH" "$rootSlash")
(setvar "LOGFILEMODE" 1)
(arxload "$moduleSlash")
MCPSTART

"@
[System.IO.File]::WriteAllText((Join-Path $absoluteRoot 'startup.scr'), $script)
$env:MCP_RUNTIME_DIR = Join-Path $absoluteRoot 'runtime'
$env:MCP_TEST_MODE = '1'
$arguments = @('"'+(Join-Path $absoluteRoot 'primary.dwg')+'"','/nologo','/nossm','/p','"'+$profileName+'"','/b','"'+(Join-Path $absoluteRoot 'startup.scr')+'"')
# AutoCAD is the interactive application under test, not a background helper.
$child = Start-Process -FilePath (Join-Path $AutoCADRoot 'acad.exe') -ArgumentList $arguments -PassThru
@{root=$absoluteRoot;profileName=$profileName;profileKey=$targetProfile;pid=$child.Id} | ConvertTo-Json -Compress
