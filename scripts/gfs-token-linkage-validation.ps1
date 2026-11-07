$ErrorActionPreference = "Stop"

function New-GfsTokenLinkageDiagnostics {
  param(
    [string] $PolicyCount = "unknown",
    [string] $ResourceRepresentation = "unknown",
    [string] $WorkerReferenceType = "unknown",
    [string] $RoleResult = "unknown",
    [string] $PermissionGroupResult = "unknown"
  )
  return [pscustomobject]@{
    policy_count = $PolicyCount
    resource_representation = $ResourceRepresentation
    worker_reference_type = $WorkerReferenceType
    role_result = $RoleResult
    permission_group_result = $PermissionGroupResult
  }
}

function New-GfsTokenLinkageResult {
  param([string] $Result, [string] $IdentityMatch, [string] $TokenStatus, [string] $ExpiryStatus, [string] $Scope, [string] $Code, [object] $Diagnostics = $null)
  if ($null -eq $Diagnostics) { $Diagnostics = New-GfsTokenLinkageDiagnostics }
  return [pscustomobject]@{ result = $Result; token_identity_match = $IdentityMatch; tokenStatus = $TokenStatus; expiry_status = $ExpiryStatus; scope = $Scope; code = $Code; diagnostics = $Diagnostics }
}

function Get-GfsSafeLinkageDiagnosticCode {
  param([object] $Diagnostics)
  if ($null -eq $Diagnostics) { return "policy_unknown_resource_unknown_worker_unknown_role_unknown_group_unknown" }
  $values = @(
    [string]$Diagnostics.policy_count,
    [string]$Diagnostics.resource_representation,
    [string]$Diagnostics.worker_reference_type,
    [string]$Diagnostics.role_result,
    [string]$Diagnostics.permission_group_result
  ) | ForEach-Object {
    if ($_ -match '^(zero|one|multiple|unknown|missing|missing_id|flat|nested|array|empty|unsupported|name|immutable_id|other|pass|wrong|matched|unresolved)$') { $_ } else { "unknown" }
  }
  return "policy_{0}_resource_{1}_worker_{2}_role_{3}_group_{4}" -f $values[0], $values[1], $values[2], $values[3], $values[4]
}

function Get-GfsResourceLeaves {
  param([Parameter(Mandatory = $true)][object] $Value, [string] $Prefix = "")
  if ($null -eq $Value) { return @() }
  if ($Value -is [string] -or $Value -is [System.ValueType]) { return [pscustomobject]@{ path = $Prefix; value = [string]$Value } }
  if ($Value -is [System.Array]) { return @() }
  $properties = @($Value.PSObject.Properties | Where-Object { $_.MemberType -eq "NoteProperty" -or $_.MemberType -eq "Property" })
  $leaves = @()
  foreach ($property in $properties) {
    $path = if ([string]::IsNullOrEmpty($Prefix)) { [string]$property.Name } else { "$Prefix.$($property.Name)" }
    $leaves += @(Get-GfsResourceLeaves -Value $property.Value -Prefix $path)
  }
  return $leaves
}

function Get-GfsPolicyDiagnostics {
  param([object] $Policies, [object] $PermissionGroups, [string] $Worker)
  $policyItems = @($Policies)
  $policyCount = if ($null -eq $Policies -or $policyItems.Count -eq 0) { "zero" } elseif ($policyItems.Count -eq 1) { "one" } else { "multiple" }
  if ($policyItems.Count -ne 1) { return New-GfsTokenLinkageDiagnostics -PolicyCount $policyCount }

  $policy = $policyItems[0]
  $resources = $policy.resources
  $representation = "unsupported"
  $leaves = @()
  if ($null -eq $resources) {
    $representation = "missing"
  } elseif ($resources -is [System.Array]) {
    $representation = "array"
  } else {
    $leaves = @(Get-GfsResourceLeaves -Value $resources)
    $hasNestedAccount = $null -ne $resources.PSObject.Properties["com.cloudflare.api.account"]
    $hasFlatKey = @($resources.PSObject.Properties | Where-Object { $_.Name -like "com.cloudflare.api.account.*" }).Count -gt 0
    if ($hasFlatKey) { $representation = "flat" }
    elseif ($hasNestedAccount) { $representation = "nested" }
    elseif ($leaves.Count -eq 0) { $representation = "empty" }
  }

  $workerReferenceType = "missing"
  $workerLeaves = @($leaves | Where-Object { $_.path -match '^com\.cloudflare\.api\.account\.(worker|workers)\.script\.' })
  if ($workerLeaves.Count -gt 0) {
    $suffix = [string]$workerLeaves[0].path -replace '^com\.cloudflare\.api\.account\.(worker|workers)\.script\.', ""
    if ($suffix -eq $Worker) { $workerReferenceType = "name" }
    elseif ($suffix -match '^[a-fA-F0-9]{32}$' -or $suffix -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') { $workerReferenceType = "immutable_id" }
    else { $workerReferenceType = "other" }
  }

  $groupItems = @($policy.permission_groups)
  $groupResult = if ($groupItems.Count -eq 0) { "missing" } elseif ($groupItems.Count -ne 1) { "multiple" } elseif ([string]::IsNullOrWhiteSpace([string]$groupItems[0].id)) { "missing_id" } else { "unresolved" }
  $roleResult = "missing"
  if ($groupItems.Count -eq 1 -and -not [string]::IsNullOrWhiteSpace([string]$groupItems[0].id)) {
    $matchedGroup = @($PermissionGroups | Where-Object { [string]$_.id -eq [string]$groupItems[0].id })
    if ($matchedGroup.Count -eq 1) {
      $groupResult = "matched"
      $roleNames = @([string]$matchedGroup[0].name, [string]$matchedGroup[0].meta.label, [string]$matchedGroup[0].meta.name)
      $roleResult = if (@($roleNames | Where-Object { $_ -match '^(?i:Individual Workers Editor|Workers Scripts (Write|Edit))$' }).Count -eq 1) { "pass" } else { "wrong" }
    }
  }
  return New-GfsTokenLinkageDiagnostics -PolicyCount $policyCount -ResourceRepresentation $representation -WorkerReferenceType $workerReferenceType -RoleResult $roleResult -PermissionGroupResult $groupResult
}

function Get-GfsExactWorkerPolicyDiagnostics {
  param([object] $Policies, [object] $PermissionGroups, [string] $Worker)
  $diagnostics = Get-GfsPolicyDiagnostics -Policies $Policies -PermissionGroups $PermissionGroups -Worker $Worker
  $policyItems = @($Policies)
  if ($policyItems.Count -ne 1) { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  $policy = $policyItems[0]
  if ([string]$policy.effect -ne "allow") { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  $resourceLeaves = @(Get-GfsResourceLeaves -Value $policy.resources)
  $expected = "com.cloudflare.api.account.worker.script.$Worker"
  if ($resourceLeaves.Count -ne 1 -or [string]$resourceLeaves[0].path -ne $expected -or [string]$resourceLeaves[0].value -ne "*") { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  $groups = @($policy.permission_groups)
  if ($groups.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$groups[0].id)) { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  $matchedGroup = @($PermissionGroups | Where-Object { [string]$_.id -eq [string]$groups[0].id })
  if ($matchedGroup.Count -ne 1) { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  $roleNames = @([string]$matchedGroup[0].name, [string]$matchedGroup[0].meta.label, [string]$matchedGroup[0].meta.name)
  if (@($roleNames | Where-Object { $_ -match '^(?i:Individual Workers Editor|Workers Scripts (Write|Edit))$' }).Count -ne 1) { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  return [pscustomobject]@{ pass = $true; diagnostics = $diagnostics }
}

function Test-GfsExactWorkerPolicy {
  param([object] $Policies, [object] $PermissionGroups, [string] $Worker)
  return (Get-GfsExactWorkerPolicyDiagnostics -Policies $Policies -PermissionGroups $PermissionGroups -Worker $Worker).pass
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
  $policyCheck = Get-GfsExactWorkerPolicyDiagnostics -Policies $Metadata.result.policies -PermissionGroups $PermissionGroups -Worker $ExpectedWorker
  if (-not $policyCheck.pass) { return New-GfsTokenLinkageResult "FAIL" "PASS" "ACTIVE" "VALID" "UNVERIFIED" "token_scope_mismatch" $policyCheck.diagnostics }
  return New-GfsTokenLinkageResult "PASS" "PASS" "ACTIVE" "VALID" "VERIFIED" "none" $policyCheck.diagnostics
}
