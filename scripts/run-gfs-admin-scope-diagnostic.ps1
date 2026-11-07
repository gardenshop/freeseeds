[CmdletBinding()]
param(
  [string] $RepoRoot = "",
  [string] $OutputPath = ""
)

$ErrorActionPreference = "Stop"
$ExpectedUser = "bi\nazim"
$AccountId = "cb5066a6d71ecdee0bd7ed8aacb4d3c2"
$WorkerName = "getfreeseeds-admin-staging"
$DeploymentTarget = "GFS-Admin-Deploy-Scoped-2026"
$MetadataTarget = "GFS-Cloudflare-Token-Metadata-Read-2026"
if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = Join-Path $PSScriptRoot ".." }
$root = (Resolve-Path $RepoRoot).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $root ".gfs-local\admin-scope-diagnostic.json" }
$outputFull = [System.IO.Path]::GetFullPath($OutputPath)
$localRoot = [System.IO.Path]::GetFullPath((Join-Path $root ".gfs-local"))
if (-not $outputFull.StartsWith($localRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "diagnostic_output_not_allowlisted" }
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
. (Join-Path $PSScriptRoot "gfs-credential-reader.ps1")

function Save-SafeResult([object] $Value) {
  $json = $Value | ConvertTo-Json -Depth 6 -Compress
  Set-Content -LiteralPath $outputFull -Value $json -Encoding UTF8
  Write-Output $json
}
function Invoke-SafeGet([string] $Token, [string] $Path) {
  try {
    $body = Invoke-RestMethod -Method Get -Uri ("https://api.cloudflare.com/client/v4" + $Path) -Headers @{ Authorization = "Bearer $Token"; Accept = "application/json" }
    return [pscustomobject]@{ available = $true; status = 200; body = $body }
  } catch {
    $status = 0
    try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch { $status = 0 }
    return [pscustomobject]@{ available = $false; status = $status; body = $null }
  }
}
function Safe-Code([string] $Value, [string] $Fallback) {
  if ($Value -match '^[A-Za-z0-9_:-]{1,64}$') { return $Value }
  return $Fallback
}

if ($env:OS -ne "Windows_NT") { Save-SafeResult ([pscustomobject]@{ result = "BLOCKED"; code = "windows_host_required" }); exit 1 }
if (((whoami).Trim()).ToLowerInvariant() -ne $ExpectedUser) { Save-SafeResult ([pscustomobject]@{ result = "BLOCKED"; code = "approved_identity_required" }); exit 1 }

$deploymentToken = $null
$metadataToken = $null
try {
  try { $deploymentToken = Read-GfsCredentialSecret $DeploymentTarget } catch { Save-SafeResult ([pscustomobject]@{ result = "BLOCKED"; code = "credential_read_failed" }); exit 1 }
  try { $metadataToken = Read-GfsCredentialSecret $MetadataTarget } catch { Save-SafeResult ([pscustomobject]@{ result = "BLOCKED"; code = "METADATA_AUTH_REQUIRED" }); exit 1 }

  $verifierPath = Join-Path $PSScriptRoot "verify-gfs-admin-token-linkage.ps1"
  $powershell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  $verifierOutput = (& $powershell -NoProfile -ExecutionPolicy Bypass -File $verifierPath 2>$null | Out-String).Trim()
  try { $linkage = $verifierOutput | ConvertFrom-Json } catch { Save-SafeResult ([pscustomobject]@{ result = "BLOCKED"; code = "sanitized_linkage_unreadable" }); exit 1 }

  $workerList = Invoke-SafeGet $deploymentToken "/accounts/$AccountId/workers/scripts"
  $workerMatches = @()
  if ($workerList.available -and $workerList.body.success -eq $true) { $workerMatches = @($workerList.body.result | Where-Object { [string]$_.id -eq $WorkerName }) }
  $authoritative = if ($workerList.available -and $workerMatches.Count -eq 1) { "PASS" } elseif (-not $workerList.available) { "UNAVAILABLE" } else { "FAIL" }
  $workerIdentity = if ($authoritative -ne "PASS") { "UNAVAILABLE" } elseif ([string]::IsNullOrWhiteSpace([string]$workerMatches[0].tag)) { "SCRIPT_NAME_ONLY" } else { "SCRIPT_NAME_AND_IMMUTABLE_TAG" }
  $diagnostics = $linkage.diagnostics
  $resolution = "UNRESOLVED"
  if ($authoritative -eq "PASS" -and $diagnostics.worker_reference_type -eq "name" -and ($diagnostics.worker_resource_family -eq "worker" -or $diagnostics.worker_resource_family -eq "workers")) { $resolution = "NAME_MATCH" }
  elseif ($linkage.result -eq "PASS" -and $diagnostics.worker_reference_type -eq "immutable_id" -and $workerIdentity -eq "SCRIPT_NAME_AND_IMMUTABLE_TAG") { $resolution = "IMMUTABLE_TAG_MATCH" }
  elseif ($diagnostics.worker_reference_type -eq "immutable_id") { $resolution = "IMMUTABLE_ID_REQUIRES_AUTHORITATIVE_TAG_MATCH" }
  Save-SafeResult ([pscustomobject]@{
    result = if ($linkage.result -eq "PASS" -and $resolution -eq "NAME_MATCH") { "PASS" } else { "DIAGNOSTIC" }
    linkage_code = Safe-Code ([string]$linkage.code) "linkage_failed"
    token_identity_match = [string]$linkage.token_identity_match
    tokenStatus = [string]$linkage.tokenStatus
    expiry_status = [string]$linkage.expiry_status
    diagnostics = $diagnostics
    authoritative_worker_record = $authoritative
    authoritative_worker_identity = $workerIdentity
    worker_scope_resolution = $resolution
    worker_read_status = [int]$workerList.status
  })
} finally {
  $deploymentToken = $null
  $metadataToken = $null
}
