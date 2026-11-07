[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ExpectedUser = "bi\nazim"
$AccountId = "cb5066a6d71ecdee0bd7ed8aacb4d3c2"
$WorkerName = "getfreeseeds-admin-staging"
$DeploymentCredentialTarget = "GFS-Admin-Deploy-Scoped-2026"
$MetadataCredentialTarget = "GFS-Cloudflare-Token-Metadata-Read-2026"
. (Join-Path $PSScriptRoot "gfs-credential-reader.ps1")
. (Join-Path $PSScriptRoot "gfs-token-linkage-validation.ps1")

function Write-GfsLinkageResult([object] $Value) { $Value | ConvertTo-Json -Compress; if ($Value.result -eq "PASS") { exit 0 }; exit 1 }
function Invoke-GfsCloudflareGet([string] $Token, [string] $Path) {
  try {
    return [pscustomobject]@{ available = $true; body = Invoke-RestMethod -Method Get -Uri ("https://api.cloudflare.com/client/v4" + $Path) -Headers @{ Authorization = "Bearer $Token"; Accept = "application/json" } }
  } catch { return [pscustomobject]@{ available = $false; body = $null } }
}

if ($env:OS -ne "Windows_NT") { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "windows_host_required") }
if (((whoami).Trim()).ToLowerInvariant() -ne $ExpectedUser) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "approved_identity_required") }

$deploymentToken = $null
$metadataToken = $null
try {
  try { $deploymentToken = Read-GfsCredentialSecret $DeploymentCredentialTarget } catch { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "credential_read_failed") }
  try { $metadataToken = Read-GfsCredentialSecret $MetadataCredentialTarget } catch { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "METADATA_AUTH_REQUIRED") }
  if ([string]::IsNullOrWhiteSpace($deploymentToken) -or [string]::IsNullOrWhiteSpace($metadataToken)) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "METADATA_AUTH_REQUIRED") }
  $verified = Invoke-GfsCloudflareGet $deploymentToken "/accounts/$AccountId/tokens/verify"
  if (-not $verified.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "token_verify_failed") }
  $tokenId = [string]$verified.body.result.id
  if ($tokenId -notmatch '^[a-fA-F0-9]{32}$') { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "FAIL" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "token_identity_missing") }
  $metadata = Invoke-GfsCloudflareGet $metadataToken "/accounts/$AccountId/tokens/$tokenId"
  if (-not $metadata.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" ([string]$verified.body.result.status).ToUpperInvariant() "UNKNOWN" "UNVERIFIED" "METADATA_AUTH_REQUIRED") }
  $groups = Invoke-GfsCloudflareGet $metadataToken "/accounts/$AccountId/tokens/permission_groups"
  if (-not $groups.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" ([string]$verified.body.result.status).ToUpperInvariant() "UNKNOWN" "UNVERIFIED" "METADATA_AUTH_REQUIRED") }
  Write-GfsLinkageResult (Test-GfsTokenLinkage -TokenVerify $verified.body -Metadata $metadata.body -PermissionGroups $groups.body.result -Now ([datetime]::UtcNow) -ExpectedWorker $WorkerName)
} finally {
  $deploymentToken = $null
  $metadataToken = $null
}
