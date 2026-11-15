$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "gfs-credential-reader.ps1")
. (Join-Path $PSScriptRoot "gfs-token-linkage-validation.ps1")

$worker = "getfreeseeds-admin-staging"
$id = "0123456789abcdef0123456789abcdef"
$verify = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; status = "active"; expires_on = "2099-01-01T00:00:00Z" } }
$policy = [pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account.worker.script.$worker" = "*" }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }
$metadata = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @($policy) } }
$groups = @([pscustomobject]@{ id = "workers-editor"; name = "Individual Workers Editor" })
function Assert-Code($actual, $expected, $name) { if ($actual.code -ne $expected) { throw "$name expected $expected, got $($actual.code)" } }
function Assert-Value($actual, $expected, $name) { if ($actual -ne $expected) { throw "$name expected $expected, got $actual" } }

Initialize-GfsCredentialReader
Initialize-GfsCredentialReader
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $metadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "none" "identity match"
$mismatch = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = ("f" * 32); policies = @($policy) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $mismatch -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_identity_mismatch" "identity mismatch"
$expired = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; status = "active"; expires_on = "2020-01-01T00:00:00Z" } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $expired -Metadata $metadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_expired" "expired token"
$wrongWorker = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @([pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account.worker.script.other-worker" = "*" }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $wrongWorker -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_scope_mismatch" "wrong worker"
$wrongWorkerDiagnostics = (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $wrongWorker -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker).diagnostics
if ($wrongWorkerDiagnostics.policy_count -ne "one" -or $wrongWorkerDiagnostics.resource_representation -ne "flat" -or $wrongWorkerDiagnostics.worker_reference_type -ne "other" -or $wrongWorkerDiagnostics.role_result -ne "pass" -or $wrongWorkerDiagnostics.permission_group_result -ne "matched") { throw "wrong worker diagnostics were not sanitized/accurate" }
$nestedResources = [pscustomobject]@{ "com.cloudflare.api.account" = [pscustomobject]@{ worker = [pscustomobject]@{ script = [pscustomobject]@{ $worker = "*" } } } }
$nestedPolicy = [pscustomobject]@{ effect = "allow"; resources = $nestedResources; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }
$nestedMetadata = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @($nestedPolicy) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $nestedMetadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "none" "nested exact Worker policy"
$nestedDiagnostics = (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $nestedMetadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker).diagnostics
if ($nestedDiagnostics.policy_count -ne "one" -or $nestedDiagnostics.resource_representation -ne "nested" -or $nestedDiagnostics.worker_reference_type -ne "name" -or $nestedDiagnostics.role_result -ne "pass" -or $nestedDiagnostics.permission_group_result -ne "matched") { throw "nested diagnostics were not sanitized/accurate" }
$immutablePolicy = [pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account.worker.script.0123456789abcdef0123456789abcdef" = "*" }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }
$immutableDiagnostics = Get-GfsPolicyDiagnostics -Policies @($immutablePolicy) -PermissionGroups $groups -Worker $worker
if ($immutableDiagnostics.worker_reference_type -ne "immutable_id" -or $immutableDiagnostics.resource_key_shape -ne "worker_script") { throw "immutable Worker reference was not classified safely" }
$opaqueId = "abcdefabcdefabcdefabcdefabcdefab"
$opaquePolicy = [pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account.$opaqueId" = "*" }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }
$opaqueRecord = [pscustomobject]@{ id = $worker; tag = $opaqueId }
$opaqueMetadata = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @($opaquePolicy) } }
$opaqueResult = Test-GfsTokenLinkage -TokenVerify $verify -Metadata $opaqueMetadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker -AuthoritativeWorkerRecord $opaqueRecord
Assert-Code $opaqueResult "none" "authoritative immutable Worker tag match"
$opaqueMismatch = Test-GfsTokenLinkage -TokenVerify $verify -Metadata $opaqueMetadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker -AuthoritativeWorkerRecord ([pscustomobject]@{ id = $worker; tag = ("f" * 32) })
Assert-Code $opaqueMismatch "token_scope_mismatch" "immutable Worker tag mismatch"
$opaqueWithoutRecord = Test-GfsTokenLinkage -TokenVerify $verify -Metadata $opaqueMetadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker
Assert-Code $opaqueWithoutRecord "token_scope_mismatch" "immutable Worker without authority"
$unknownFamilyPolicy = [pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account.unknown.scope.$worker" = "*" }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }
$unknownFamilyDiagnostics = Get-GfsPolicyDiagnostics -Policies @($unknownFamilyPolicy) -PermissionGroups $groups -Worker $worker
if ($unknownFamilyDiagnostics.worker_reference_type -ne "name" -or $unknownFamilyDiagnostics.resource_key_shape -ne "other" -or $unknownFamilyDiagnostics.worker_resource_family -ne "unknown") { throw "unknown resource family was not classified safely" }
$wrongRoleGroups = @([pscustomobject]@{ id = "workers-editor"; name = "Workers Routes Write" })
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $nestedMetadata -PermissionGroups $wrongRoleGroups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_scope_mismatch" "wrong role"
$wildcardNested = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @([pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account" = [pscustomobject]@{ worker = [pscustomobject]@{ script = "*" } } }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $wildcardNested -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_scope_mismatch" "all Worker wildcard"
$extraResource = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @([pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account.worker.script.$worker" = "*"; "com.cloudflare.api.account.worker.script.other" = "*" }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $extraResource -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_scope_mismatch" "extra Worker resource"
$multiplePolicies = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @($nestedPolicy, $nestedPolicy) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $multiplePolicies -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_scope_mismatch" "multiple policies"
$denied = [pscustomobject]@{ success = $false; result = $null }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $denied -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "METADATA_AUTH_REQUIRED" "denied metadata"
if ((Test-GfsLinkageCredentialAvailability -DeploymentAvailable $false -MetadataAvailable $true) -ne "credential_read_failed") { throw "missing deployment credential did not fail closed" }
if ((Test-GfsLinkageCredentialAvailability -DeploymentAvailable $true -MetadataAvailable $false) -ne "METADATA_AUTH_REQUIRED") { throw "missing metadata credential did not fail closed" }
if ((Test-GfsLinkageTarget -AccountId "wrong" -Worker $worker) -ne "account_mismatch") { throw "wrong account accepted" }
if ((Test-GfsLinkageTarget -AccountId "cb5066a6d71ecdee0bd7ed8aacb4d3c2" -Worker "wrong") -ne "worker_mismatch") { throw "wrong worker target accepted" }
$safe = (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $metadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker | ConvertTo-Json -Compress)
if ($safe -match $id -or $safe -match "synthetic-secret") { throw "sensitive output leaked" }
if ($safe -match "0123456789abcdef|other-worker|Workers Routes") { throw "diagnostic output leaked sensitive policy identifiers" }
Assert-Code (Test-GfsTokenVerificationState -TokenVerify ([pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; status = "revoked"; expires_on = "2099-01-01T00:00:00Z" } }) -Now ([datetime]"2026-11-07T00:00:00Z")) "token_revoked" "revoked token"
Assert-Code (Test-GfsTokenVerificationState -TokenVerify ([pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; status = "expired"; expires_on = "2099-01-01T00:00:00Z" } }) -Now ([datetime]"2026-11-07T00:00:00Z")) "token_expired" "explicit expired status"

$mockToken = "synthetic-secret-must-not-escape"
$expiredResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 401; body = [pscustomobject]@{ success = $false; errors = @([pscustomobject]@{ code = 10000; message = "API token expired" }) } } }
$expiredRead = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/tokens/verify" -MockRequest $expiredResponse
Assert-Value $expiredRead.failureCode "token_expired_http401_cf_10000" "expired API response"
Assert-Value $expiredRead.httpStatus 401 "expired API status"
Assert-Value $expiredRead.providerErrorCode "cf_10000" "expired API provider code"

$revokedResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 401; body = [pscustomobject]@{ success = $false; errors = @([pscustomobject]@{ code = 10000; message = "API token revoked" }) } } }
$revokedRead = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/tokens/verify" -MockRequest $revokedResponse
Assert-Value $revokedRead.failureCode "token_revoked_http401_cf_10000" "revoked API response"

$forbiddenResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 403; body = [pscustomobject]@{ success = $false; errors = @([pscustomobject]@{ code = 10000; message = "Permission denied" }) } } }
$forbiddenRead = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/workers/scripts" -MockRequest $forbiddenResponse
Assert-Value $forbiddenRead.failureCode "authoritative_worker_forbidden_http403_cf_10000" "scoped token forbidden list"

$accountMissingResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 404; body = [pscustomobject]@{ success = $false; errors = @([pscustomobject]@{ code = 7003; message = "Account not found" }) } } }
$accountMissing = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/tokens/verify" -MockRequest $accountMissingResponse
Assert-Value $accountMissing.failureCode "wrong_account_http404_cf_7003" "wrong account response"

$workerMissingResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 404; body = [pscustomobject]@{ success = $false; errors = @([pscustomobject]@{ code = 1001; message = "Worker not found" }) } } }
$workerMissing = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/workers/scripts" -MockRequest $workerMissingResponse
Assert-Value $workerMissing.failureCode "authoritative_worker_missing_http404_cf_1001" "missing Worker response"

$apiErrorResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 500; body = [pscustomobject]@{ success = $false; errors = @([pscustomobject]@{ code = 1234; message = "Internal error" }) } } }
$apiError = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/tokens/permission_groups" -MockRequest $apiErrorResponse
Assert-Value $apiError.failureCode "permission_groups_api_error_http500_cf_1234" "Cloudflare API error"

$validWorkerResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 200; body = [pscustomobject]@{ success = $true; result = @([pscustomobject]@{ id = $worker; tag = "abcdefabcdefabcdefabcdefabcdefab" }) } } }
$validWorkerRead = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/workers/scripts" -MockRequest $validWorkerResponse
if (-not $validWorkerRead.available -or $validWorkerRead.body.result.Count -ne 1) { throw "official Worker list shape was rejected" }

$invalidShapeResponse = { param($token, $path) [pscustomobject]@{ httpStatus = 200; body = [pscustomobject]@{ result = @() } } }
$invalidShape = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/workers/scripts" -MockRequest $invalidShapeResponse
Assert-Value $invalidShape.failureCode "invalid_response_shape" "missing Cloudflare success property"

$transportFailure = { param($token, $path) throw "synthetic transport failure" }
$transportRead = Invoke-GfsCloudflareGet -Token $mockToken -Path "/accounts/$id/workers/scripts" -MockRequest $transportFailure
Assert-Value $transportRead.failureCode "authoritative_worker_transport_error" "transport error"
$mockOutput = @($expiredRead, $revokedRead, $forbiddenRead, $accountMissing, $workerMissing, $apiError, $validWorkerRead, $invalidShape, $transportRead) | ConvertTo-Json -Compress
if ($mockOutput -match $mockToken -or $mockOutput -match "Permission denied|Account not found|Worker not found|Internal error|API token") { throw "mock response leaked token or raw provider message" }
"token_linkage_validation=PASS (16/16); token_state_mocks=PASS (2/2); cloudflare_readback_mocks=PASS (10/10); credential_reader_add_type=PASS (2/2)"
