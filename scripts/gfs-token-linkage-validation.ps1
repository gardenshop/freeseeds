$ErrorActionPreference = "Stop"

function New-GfsTokenLinkageDiagnostics {
  param(
    [string] $PolicyCount = "unknown",
    [string] $ResourceRepresentation = "unknown",
    [string] $ResourceKeyShape = "unknown",
    [string] $WorkerReferenceType = "unknown",
    [string] $WorkerResourceFamily = "unknown",
    [string] $RoleResult = "unknown",
    [string] $PermissionGroupResult = "unknown"
  )
  return [pscustomobject]@{
    policy_count = $PolicyCount
    resource_representation = $ResourceRepresentation
    resource_key_shape = $ResourceKeyShape
    worker_reference_type = $WorkerReferenceType
    worker_resource_family = $WorkerResourceFamily
    role_result = $RoleResult
    permission_group_result = $PermissionGroupResult
  }
}

function New-GfsTokenLinkageResult {
  param([string] $Result, [string] $IdentityMatch, [string] $TokenStatus, [string] $ExpiryStatus, [string] $Scope, [string] $Code, [object] $Diagnostics = $null, [int] $HttpStatus = 0, [string] $ProviderErrorCode = "none", [string] $MetadataTokenStatus = "unknown", [string] $MetadataExpiryStatus = "unknown")
  if ($null -eq $Diagnostics) { $Diagnostics = New-GfsTokenLinkageDiagnostics }
  return [pscustomobject]@{ result = $Result; token_identity_match = $IdentityMatch; tokenStatus = $TokenStatus; expiry_status = $ExpiryStatus; metadata_token_status = $MetadataTokenStatus; metadata_expiry_status = $MetadataExpiryStatus; scope = $Scope; code = $Code; httpStatus = $(if ($HttpStatus -gt 0) { $HttpStatus } else { $null }); providerErrorCode = $ProviderErrorCode; diagnostics = $Diagnostics }
}

function Get-GfsCloudflareProviderErrorCode {
  param([object] $Body)
  $errors = @($Body.errors)
  if ($errors.Count -eq 0) { return "none" }
  $code = [string]$errors[0].code
  if ($code -match '^\d{1,12}$') { return "cf_$code" }
  return "unknown"
}

function Get-GfsCloudflareFailureCode {
  param([string] $Path, [int] $HttpStatus, [string] $ProviderErrorCode = "none", [string] $ProviderMessage = "")
  $stage = "cloudflare"
  if ($Path -match '/tokens/verify$') { $stage = "token_verify" }
  elseif ($Path -match '/workers/scripts$') { $stage = "authoritative_worker" }
  elseif ($Path -match '/workers/scripts/[^/]+/deployments$') { $stage = "target_worker" }
  elseif ($Path -match '/tokens/permission_groups$') { $stage = "permission_groups" }
  elseif ($Path -match '/tokens/[a-fA-F0-9]{32}$') { $stage = "token_metadata" }

  if ($stage -eq "token_verify" -and $ProviderMessage -match '(?i)\b(expired|expiration)\b') { $failure = "token_expired" }
  elseif ($stage -eq "token_verify" -and $ProviderMessage -match '(?i)\b(revoked|disabled)\b') { $failure = "token_revoked" }
  elseif ($HttpStatus -eq 401) { $failure = "${stage}_unauthorized" }
  elseif ($HttpStatus -eq 403) { $failure = "${stage}_forbidden" }
  elseif ($HttpStatus -eq 404 -and $stage -eq "token_verify") { $failure = "wrong_account" }
  elseif ($HttpStatus -eq 404 -and $stage -eq "authoritative_worker") { $failure = "authoritative_worker_missing" }
  elseif ($HttpStatus -eq 404 -and $stage -eq "target_worker") { $failure = "target_worker_missing" }
  elseif ($HttpStatus -eq 404) { $failure = "${stage}_resource_missing" }
  elseif ($HttpStatus -gt 0) { $failure = "${stage}_api_error" }
  else { $failure = "${stage}_transport_error" }

  if ($HttpStatus -gt 0) { $failure += "_http$HttpStatus" }
  if ($ProviderErrorCode -match '^cf_\d{1,12}$') { $failure += "_$ProviderErrorCode" }
  return $failure
}

function ConvertTo-GfsCloudflareReadbackResult {
  param([string] $Path, [int] $HttpStatus, [object] $Body)
  $providerCode = Get-GfsCloudflareProviderErrorCode $Body
  $successProperty = if ($null -ne $Body) { $Body.PSObject.Properties["success"] } else { $null }
  if ($HttpStatus -lt 200 -or $HttpStatus -ge 300) {
    $message = [string]@($Body.errors)[0].message
    $code = Get-GfsCloudflareFailureCode -Path $Path -HttpStatus $HttpStatus -ProviderErrorCode $providerCode -ProviderMessage $message
    return [pscustomobject]@{ available = $false; body = $null; httpStatus = $HttpStatus; providerErrorCode = $providerCode; failureCode = $code }
  }
  if ($null -eq $successProperty -or $successProperty.Value -isnot [bool]) {
    return [pscustomobject]@{ available = $false; body = $null; httpStatus = $HttpStatus; providerErrorCode = $providerCode; failureCode = "invalid_response_shape" }
  }
  if ($successProperty.Value -ne $true) {
    $message = [string]@($Body.errors)[0].message
    $code = Get-GfsCloudflareFailureCode -Path $Path -HttpStatus $HttpStatus -ProviderErrorCode $providerCode -ProviderMessage $message
    return [pscustomobject]@{ available = $false; body = $null; httpStatus = $HttpStatus; providerErrorCode = $providerCode; failureCode = $code }
  }
  return [pscustomobject]@{ available = $true; body = $Body; httpStatus = $HttpStatus; providerErrorCode = "none"; failureCode = "none" }
}

function Invoke-GfsCloudflareGet {
  param([string] $Token, [string] $Path, [scriptblock] $MockRequest = $null)
  if ($null -ne $MockRequest) {
    try {
      $mock = & $MockRequest $Token $Path
      if ($null -eq $mock -or $mock.PSObject.Properties["httpStatus"] -eq $null -or $mock.PSObject.Properties["body"] -eq $null) {
        return [pscustomobject]@{ available = $false; body = $null; httpStatus = $null; providerErrorCode = "none"; failureCode = "invalid_response_shape" }
      }
      return ConvertTo-GfsCloudflareReadbackResult -Path $Path -HttpStatus ([int]$mock.httpStatus) -Body $mock.body
    } catch {
      return [pscustomobject]@{ available = $false; body = $null; httpStatus = $null; providerErrorCode = "none"; failureCode = (Get-GfsCloudflareFailureCode -Path $Path -HttpStatus 0) }
    }
  }

  try {
    $body = Invoke-RestMethod -Method Get -Uri ("https://api.cloudflare.com/client/v4" + $Path) -Headers @{ Authorization = "Bearer $Token"; Accept = "application/json" } -ErrorAction Stop
    return ConvertTo-GfsCloudflareReadbackResult -Path $Path -HttpStatus 200 -Body $body
  } catch {
    $response = $_.Exception.Response
    $httpStatus = 0
    $errorBody = $null
    $providerMessage = ""
    if ($null -ne $response) {
      try { $httpStatus = [int]$response.StatusCode } catch { $httpStatus = 0 }
      $reader = $null
      try {
        $stream = $response.GetResponseStream()
        if ($null -ne $stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $rawBody = $reader.ReadToEnd()
          try { $errorBody = ConvertFrom-Json -InputObject $rawBody -ErrorAction Stop; $providerMessage = [string]@($errorBody.errors)[0].message } catch { }
          $rawBody = $null
        }
      } catch { }
      finally {
        if ($null -ne $reader) { $reader.Dispose() }
        try { $response.Close() } catch { }
      }
    }
    $providerCode = Get-GfsCloudflareProviderErrorCode $errorBody
    $failureCode = Get-GfsCloudflareFailureCode -Path $Path -HttpStatus $httpStatus -ProviderErrorCode $providerCode -ProviderMessage $providerMessage
    $providerMessage = $null
    $errorBody = $null
    return [pscustomobject]@{ available = $false; body = $null; httpStatus = $(if ($httpStatus -gt 0) { $httpStatus } else { $null }); providerErrorCode = $providerCode; failureCode = $failureCode }
  }
}

function Test-GfsTokenVerificationState {
  param([object] $TokenVerify, [datetime] $Now)
  $status = [string]$TokenVerify.result.status
  $normalizedStatus = $status.ToUpperInvariant()
  $expiryText = [string]$TokenVerify.result.expires_on
  $expiry = [datetime]::MinValue
  if ($normalizedStatus -eq "REVOKED" -or $normalizedStatus -eq "DISABLED") { return [pscustomobject]@{ pass = $false; tokenStatus = "REVOKED"; expiryStatus = "UNKNOWN"; code = "token_revoked" } }
  if ($normalizedStatus -eq "EXPIRED") { return [pscustomobject]@{ pass = $false; tokenStatus = "EXPIRED"; expiryStatus = "EXPIRED"; code = "token_expired" } }
  if (-not [datetime]::TryParse($expiryText, [ref]$expiry)) { return [pscustomobject]@{ pass = $false; tokenStatus = $(if ($normalizedStatus) { $normalizedStatus } else { "UNKNOWN" }); expiryStatus = "UNKNOWN"; code = "token_expiry_missing" } }
  if ($normalizedStatus -eq "EXPIRED" -or $expiry.ToUniversalTime() -le $Now.ToUniversalTime()) { return [pscustomobject]@{ pass = $false; tokenStatus = "EXPIRED"; expiryStatus = "EXPIRED"; code = "token_expired" } }
  if ($TokenVerify.success -ne $true -or $normalizedStatus -ne "ACTIVE") { return [pscustomobject]@{ pass = $false; tokenStatus = $(if ($normalizedStatus) { $normalizedStatus } else { "UNKNOWN" }); expiryStatus = "VALID"; code = "token_not_active" } }
  if ([string]$TokenVerify.result.id -notmatch '^[a-fA-F0-9]{32}$') { return [pscustomobject]@{ pass = $false; tokenStatus = "ACTIVE"; expiryStatus = "VALID"; code = "token_identity_missing" } }
  return [pscustomobject]@{ pass = $true; tokenStatus = "ACTIVE"; expiryStatus = "VALID"; code = "none" }
}

function Get-GfsSafeLinkageDiagnosticCode {
  param([object] $Diagnostics)
  if ($null -eq $Diagnostics) { return "policy_unknown_resource_unknown_worker_unknown_family_unknown_role_unknown_group_unknown" }
  $values = @(
    [string]$Diagnostics.policy_count,
    [string]$Diagnostics.resource_representation,
    [string]$Diagnostics.resource_key_shape,
    [string]$Diagnostics.worker_reference_type,
    [string]$Diagnostics.worker_resource_family,
    [string]$Diagnostics.role_result,
    [string]$Diagnostics.permission_group_result
  ) | ForEach-Object {
    if ($_ -match '^(zero|one|multiple|unknown|missing|missing_id|flat|nested|array|empty|unsupported|name|immutable_id|other|worker|workers|worker_script|workers_script|script|pass|wrong|matched|unresolved)$') { $_ } else { "unknown" }
  }
  return "policy_{0}_resource_{1}_shape_{2}_worker_{3}_family_{4}_role_{5}_group_{6}" -f $values[0], $values[1], $values[2], $values[3], $values[4], $values[5], $values[6]
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
  $workerResourceFamily = "unknown"
  $resourceKeyShape = "unknown"
  $workerLeaves = @($leaves | Where-Object { $_.path -match '^com\.cloudflare\.api\.account\.(worker|workers)\.script\.' })
  if ($leaves.Count -eq 1 -and [string]$leaves[0].path -like "com.cloudflare.api.account.*") {
    $keyTail = ([string]$leaves[0].path -replace '^com\.cloudflare\.api\.account\.', "")
    if ($keyTail -match '^worker\.script\.') { $resourceKeyShape = "worker_script"; $workerResourceFamily = "worker" }
    elseif ($keyTail -match '^workers\.script\.') { $resourceKeyShape = "workers_script"; $workerResourceFamily = "workers" }
    elseif ($keyTail -match '^script\.') { $resourceKeyShape = "script" }
    else { $resourceKeyShape = "other" }
    $lastSegment = ([string]$leaves[0].path -split '\.')[-1]
    if ($lastSegment -eq $Worker) { $workerReferenceType = "name" }
    elseif ($lastSegment -match '^[a-fA-F0-9]{32}$' -or $lastSegment -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') { $workerReferenceType = "immutable_id" }
    elseif ($lastSegment -ne "script" -and $lastSegment -ne "worker" -and $lastSegment -ne "workers") { $workerReferenceType = "other" }
  }
  if ($workerLeaves.Count -gt 0) {
    $workerResourceFamily = if ([string]$workerLeaves[0].path -match '^com\.cloudflare\.api\.account\.(worker|workers)\.script\.') { $Matches[1] } else { "unknown" }
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
  return New-GfsTokenLinkageDiagnostics -PolicyCount $policyCount -ResourceRepresentation $representation -ResourceKeyShape $resourceKeyShape -WorkerReferenceType $workerReferenceType -WorkerResourceFamily $workerResourceFamily -RoleResult $roleResult -PermissionGroupResult $groupResult
}

function Test-GfsOpaqueWorkerResourceMatch {
  param(
    [object] $ResourceLeaf,
    [object] $AuthoritativeWorkerRecord,
    [string] $Worker
  )
  if ($null -eq $ResourceLeaf -or $null -eq $AuthoritativeWorkerRecord) { return $false }
  $path = [string]$ResourceLeaf.path
  if ($path -notlike "com.cloudflare.api.account.*" -or [string]$ResourceLeaf.value -ne "*") { return $false }
  $reference = ($path -split '\.')[-1]
  if ($reference -notmatch '^[a-fA-F0-9]{32}$' -and $reference -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') { return $false }
  if ([string]$AuthoritativeWorkerRecord.id -ne $Worker) { return $false }
  # The official Worker Scripts list calls `id` the script name and `tag`
  # the immutable script ID.  Match both internally; never accept name-only
  # or a successful Worker read as proof of an opaque token resource.
  return ([string]$AuthoritativeWorkerRecord.tag -eq $reference)
}

function Get-GfsExactWorkerPolicyDiagnostics {
  param([object] $Policies, [object] $PermissionGroups, [string] $Worker, [object] $AuthoritativeWorkerRecord = $null)
  $diagnostics = Get-GfsPolicyDiagnostics -Policies $Policies -PermissionGroups $PermissionGroups -Worker $Worker
  $policyItems = @($Policies)
  if ($policyItems.Count -ne 1) { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  $policy = $policyItems[0]
  if ([string]$policy.effect -ne "allow") { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
  $resourceLeaves = @(Get-GfsResourceLeaves -Value $policy.resources)
  $expected = "com.cloudflare.api.account.worker.script.$Worker"
  $canonicalMatch = $resourceLeaves.Count -eq 1 -and [string]$resourceLeaves[0].path -eq $expected -and [string]$resourceLeaves[0].value -eq "*"
  $opaqueMatch = $false
  if (-not $canonicalMatch -and $resourceLeaves.Count -eq 1 -and $diagnostics.resource_representation -eq "flat" -and $diagnostics.worker_reference_type -eq "immutable_id") {
    $opaqueMatch = Test-GfsOpaqueWorkerResourceMatch -ResourceLeaf $resourceLeaves[0] -AuthoritativeWorkerRecord $AuthoritativeWorkerRecord -Worker $Worker
  }
  if (-not $canonicalMatch -and -not $opaqueMatch) { return [pscustomobject]@{ pass = $false; diagnostics = $diagnostics } }
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
    [Parameter(Mandatory = $true)][string] $ExpectedWorker,
    [object] $AuthoritativeWorkerRecord = $null
  )
  $tokenState = Test-GfsTokenVerificationState -TokenVerify $TokenVerify -Now $Now
  if (-not $tokenState.pass) { return New-GfsTokenLinkageResult "FAIL" "FAIL" $tokenState.tokenStatus $tokenState.expiryStatus "UNVERIFIED" $tokenState.code }
  $tokenId = [string]$TokenVerify.result.id
  if ($Metadata.success -ne $true) { return New-GfsTokenLinkageResult "FAIL" "UNKNOWN" "ACTIVE" "VALID" "UNVERIFIED" "METADATA_AUTH_REQUIRED" }
  if ([string]$Metadata.result.id -ne $tokenId) { return New-GfsTokenLinkageResult "FAIL" "FAIL" "ACTIVE" "VALID" "UNVERIFIED" "token_identity_mismatch" }
  $policyCheck = Get-GfsExactWorkerPolicyDiagnostics -Policies $Metadata.result.policies -PermissionGroups $PermissionGroups -Worker $ExpectedWorker -AuthoritativeWorkerRecord $AuthoritativeWorkerRecord
  if (-not $policyCheck.pass) { return New-GfsTokenLinkageResult "FAIL" "PASS" "ACTIVE" "VALID" "UNVERIFIED" "token_scope_mismatch" $policyCheck.diagnostics }
  return New-GfsTokenLinkageResult "PASS" "PASS" "ACTIVE" "VALID" "VERIFIED" "none" $policyCheck.diagnostics
}
