$ErrorActionPreference = "Stop"

function New-GfsTokenLinkageResult {
  param([string] $Result, [string] $IdentityMatch, [string] $TokenStatus, [string] $ExpiryStatus, [string] $Scope, [string] $Code)
  return [pscustomobject]@{ result = $Result; token_identity_match = $IdentityMatch; tokenStatus = $TokenStatus; expiry_status = $ExpiryStatus; scope = $Scope; code = $Code }
}

function Test-GfsExactWorkerPolicy {
  param([object] $Policies, [object] $PermissionGroups, [string] $Worker)
  if ($null -eq $Policies -or @($Policies).Count -ne 1) { return $false }
  $policy = @($Policies)[0]
  if ([string]$policy.effect -ne "allow") { return $false }
  $resources = $policy.resources
  if ($null -eq $resources) { return $false }
  $resourceKeys = @($resources.psobject.Properties.Name)
  $expected = "com.cloudflare.api.account.worker.script.$Worker"
  if ($resourceKeys.Count -ne 1 -or $resourceKeys[0] -ne $expected) { return $false }
  if ([string]$resources.PSObject.Properties[$expected].Value -ne "*") { return $false }
  $groups = @($policy.permission_groups)
  if ($groups.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$groups[0].id)) { return $false }
  $matchedGroup = @($PermissionGroups | Where-Object { [string]$_.id -eq [string]$groups[0].id })
  if ($matchedGroup.Count -ne 1 -or [string]$matchedGroup[0].name -notmatch '(?i)(individual workers editor|workers.*(edit|write))') { return $false }
  return $true
}

function Test-GfsLinkageCredentialAvailability {
  param([bool] $DeploymentAvailable, [bool] $MetadataAvailable)
  if (-not $DeploymentAvailable) { return "credential_read_failed" }
  if (-not $MetadataAvailable) { return "METADATA_AUTH_REQUIRED" }
  return "none"
}

function Test-GfsLinkageTarget {
  param([string] $AccountId, [string] $Worker)
  if ($AccountId -ne "cb5066a6d71ecdee0bd7ed8aacb4d3c2") { return "account_mismatch" }
  if ($Worker -ne "getfreeseeds-admin-staging") { return "worker_mismatch" }
  return "none"
}

function Test-GfsTokenLinkage {
  param(
    [Parameter(Mandatory = $true)][object] $TokenVerify,
    [Parameter(Mandatory = $true)][object] $Metadata,
    [Parameter(Mandatory = $true)][object] $PermissionGroups,
    [Parameter(Mandatory = $true)][datetime] $Now,
    [Parameter(Mandatory = $true)][string] $ExpectedWorker
  )
  $status = [string]$TokenVerify.result.status
  $expiryText = [string]$TokenVerify.result.expires_on
  $expiry = [datetime]::MinValue
  if (-not [datetime]::TryParse($expiryText, [ref]$expiry)) { return New-GfsTokenLinkageResult "FAIL" "FAIL" ($status.ToUpperInvariant()) "UNKNOWN" "UNVERIFIED" "token_expiry_missing" }
  if ($TokenVerify.success -ne $true -or $status.ToUpperInvariant() -ne "ACTIVE") { return New-GfsTokenLinkageResult "FAIL" "FAIL" ($status.ToUpperInvariant()) "EXPIRED" "UNVERIFIED" "token_not_active" }
  if ($expiry.ToUniversalTime() -le $Now.ToUniversalTime()) { return New-GfsTokenLinkageResult "FAIL" "FAIL" "ACTIVE" "EXPIRED" "UNVERIFIED" "token_expired" }
  $tokenId = [string]$TokenVerify.result.id
  if ($tokenId -notmatch '^[a-fA-F0-9]{32}$') { return New-GfsTokenLinkageResult "FAIL" "FAIL" "ACTIVE" "VALID" "UNVERIFIED" "token_identity_missing" }
  if ($Metadata.success -ne $true) { return New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "ACTIVE" "VALID" "UNVERIFIED" "METADATA_AUTH_REQUIRED" }
  if ([string]$Metadata.result.id -ne $tokenId) { return New-GfsTokenLinkageResult "FAIL" "FAIL" "ACTIVE" "VALID" "UNVERIFIED" "token_identity_mismatch" }
  if (-not (Test-GfsExactWorkerPolicy -Policies $Metadata.result.policies -PermissionGroups $PermissionGroups -Worker $ExpectedWorker)) { return New-GfsTokenLinkageResult "FAIL" "PASS" "ACTIVE" "VALID" "UNVERIFIED" "token_scope_mismatch" }
  return New-GfsTokenLinkageResult "PASS" "PASS" "ACTIVE" "VALID" "VERIFIED" "none"
}
