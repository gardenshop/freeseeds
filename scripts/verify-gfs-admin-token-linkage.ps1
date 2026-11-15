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
if ($env:OS -ne "Windows_NT") { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "windows_host_required") }
if (((whoami).Trim()).ToLowerInvariant() -ne $ExpectedUser) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "approved_identity_required") }

$deploymentToken = $null
$metadataToken = $null
try {
  try { $deploymentToken = Read-GfsCredentialSecret $DeploymentCredentialTarget } catch { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "credential_read_failed") }
  try { $metadataToken = Read-GfsCredentialSecret $MetadataCredentialTarget } catch { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "METADATA_AUTH_REQUIRED") }
  if ([string]::IsNullOrWhiteSpace($deploymentToken) -or [string]::IsNullOrWhiteSpace($metadataToken)) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" "METADATA_AUTH_REQUIRED") }
  $verified = Invoke-GfsCloudflareGet $deploymentToken "/accounts/$AccountId/tokens/verify"
  if (-not $verified.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "UNKNOWN" "UNKNOWN" "UNVERIFIED" $verified.failureCode $null $verified.httpStatus $verified.providerErrorCode) }
  $deploymentState = Test-GfsTokenVerificationState -TokenVerify $verified.body -Now ([datetime]::UtcNow)
  if (-not $deploymentState.pass) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "FAIL" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" $deploymentState.code) }
  $metadataVerified = Invoke-GfsCloudflareGet $metadataToken "/accounts/$AccountId/tokens/verify"
  if (-not $metadataVerified.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" ("metadata_" + $metadataVerified.failureCode) $null $metadataVerified.httpStatus $metadataVerified.providerErrorCode "UNKNOWN" "UNKNOWN") }
  $metadataState = Test-GfsTokenVerificationState -TokenVerify $metadataVerified.body -Now ([datetime]::UtcNow)
  if (-not $metadataState.pass) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" ("metadata_" + $metadataState.code) $null 0 "none" $metadataState.tokenStatus $metadataState.expiryStatus) }
  $tokenId = [string]$verified.body.result.id
  $targetReadback = Invoke-GfsCloudflareGet $deploymentToken "/accounts/$AccountId/workers/scripts/$WorkerName/deployments"
  if (-not $targetReadback.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "PASS" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" $targetReadback.failureCode $null $targetReadback.httpStatus $targetReadback.providerErrorCode $metadataState.tokenStatus $metadataState.expiryStatus) }
  if ($null -eq $targetReadback.body.result.deployments -or $targetReadback.body.result.deployments -isnot [System.Array]) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "PASS" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" "invalid_response_shape" $null 200 "none" $metadataState.tokenStatus $metadataState.expiryStatus) }
  # The least-privilege deployment token cannot enumerate every account Worker.
  # Use the separately named metadata-read credential for this authoritative map.
  $workerList = Invoke-GfsCloudflareGet $metadataToken "/accounts/$AccountId/workers/scripts"
  if (-not $workerList.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "PASS" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" $workerList.failureCode $null $workerList.httpStatus $workerList.providerErrorCode $metadataState.tokenStatus $metadataState.expiryStatus) }
  if ($workerList.body.result -isnot [System.Array]) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "PASS" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" "invalid_response_shape" $null 200 "none" $metadataState.tokenStatus $metadataState.expiryStatus) }
  $workerRecords = @($workerList.body.result | Where-Object { [string]$_.id -eq $WorkerName })
  if ($workerRecords.Count -ne 1) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "PASS" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" "authoritative_worker_mismatch" $null 200 "none" $metadataState.tokenStatus $metadataState.expiryStatus) }
  $authoritativeWorker = $workerRecords[0]
  $metadata = Invoke-GfsCloudflareGet $metadataToken "/accounts/$AccountId/tokens/$tokenId"
  if (-not $metadata.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" $metadata.failureCode $null $metadata.httpStatus $metadata.providerErrorCode $metadataState.tokenStatus $metadataState.expiryStatus) }
  $groups = Invoke-GfsCloudflareGet $metadataToken "/accounts/$AccountId/tokens/permission_groups"
  if (-not $groups.available) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" $groups.failureCode $null $groups.httpStatus $groups.providerErrorCode $metadataState.tokenStatus $metadataState.expiryStatus) }
  if ($groups.body.result -isnot [System.Array]) { Write-GfsLinkageResult (New-GfsTokenLinkageResult "FAIL" "UNKNOWN" $deploymentState.tokenStatus $deploymentState.expiryStatus "UNVERIFIED" "invalid_response_shape" $null 200 "none" $metadataState.tokenStatus $metadataState.expiryStatus) }
  $linkage = Test-GfsTokenLinkage -TokenVerify $verified.body -Metadata $metadata.body -PermissionGroups $groups.body.result -Now ([datetime]::UtcNow) -ExpectedWorker $WorkerName -AuthoritativeWorkerRecord $authoritativeWorker
  $linkage.metadata_token_status = $metadataState.tokenStatus
  $linkage.metadata_expiry_status = $metadataState.expiryStatus
  Write-GfsLinkageResult $linkage
} finally {
  $deploymentToken = $null
  $metadataToken = $null
}
