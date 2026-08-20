# Hourly tester comp for the closed test.
#
# Reads scripts/testers-emails.txt and passes the addresses to
# tester-comps.mjs INLINE rather than as a members file. The file path in that
# script carries a 7-day staleness refusal, which exists for the scraped Google
# Group flow and would stop a 14-day test dead halfway through. This list is
# fixed rather than scraped, so the guard does not apply and must not fire.
#
# PowerShell rather than a .cmd wrapper: the batch version had to call
# PowerShell through `for /f` backticks to parse the list, and cmd's own escape
# character mangled the regex before PowerShell ever saw it. One language.
#
# Safe to run repeatedly. tester-comps.mjs grants one comp per account ever and
# the marker blocks a re-grant, so an hourly run is idempotent.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$log = 'G:\Dev\vollyio-tester-comps.log'
$listPath = Join-Path $repo 'scripts\testers-emails.txt'

function Write-Log([string]$message) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    Add-Content -Path $log -Value $line -Encoding utf8
}

Set-Location $repo

if (-not (Test-Path $listPath)) {
    Write-Log "no list at $listPath"
    exit 0
}

$emails = @(Get-Content $listPath |
    Where-Object { $_ -notmatch '^\s*#' -and $_.Trim() -ne '' } |
    ForEach-Object { $_.Trim() })

if ($emails.Count -eq 0) {
    Write-Log 'no tester emails listed, nothing to do'
    exit 0
}

$joined = $emails -join ','
Write-Log "comping $($emails.Count): $joined"

# NO 2>&1 ON THE NATIVE CALL. Windows PowerShell 5.1 wraps each stderr line
# from an exe in a NativeCommandError, which under ErrorActionPreference Stop
# terminates the script even when node exited 0. node writes a module-type
# warning to stderr on every run, so redirecting it here failed the task on a
# run that had actually granted the comps.
$ErrorActionPreference = 'Continue'
$output = & node scripts/tester-comps.mjs --members $joined --apply
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'

$output | ForEach-Object { Write-Log "  $_" }
Write-Log "exit $code"
exit $code
