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

Initialize-GfsCredentialReader
Initialize-GfsCredentialReader
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $metadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "none" "identity match"
$mismatch = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = ("f" * 32); policies = @($policy) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $mismatch -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_identity_mismatch" "identity mismatch"
$expired = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; status = "active"; expires_on = "2020-01-01T00:00:00Z" } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $expired -Metadata $metadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_expired" "expired token"
$wrongWorker = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @([pscustomobject]@{ effect = "allow"; resources = [pscustomobject]@{ "com.cloudflare.api.account.worker.script.other-worker" = "*" }; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $wrongWorker -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "token_scope_mismatch" "wrong worker"
$nestedResources = [pscustomobject]@{ "com.cloudflare.api.account" = [pscustomobject]@{ worker = [pscustomobject]@{ script = [pscustomobject]@{ $worker = "*" } } } }
$nestedPolicy = [pscustomobject]@{ effect = "allow"; resources = $nestedResources; permission_groups = @([pscustomobject]@{ id = "workers-editor" }) }
$nestedMetadata = [pscustomobject]@{ success = $true; result = [pscustomobject]@{ id = $id; policies = @($nestedPolicy) } }
Assert-Code (Test-GfsTokenLinkage -TokenVerify $verify -Metadata $nestedMetadata -PermissionGroups $groups -Now ([datetime]"2026-11-07T00:00:00Z") -ExpectedWorker $worker) "none" "nested exact Worker policy"
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
"token_linkage_validation=PASS (13/13); credential_reader_add_type=PASS (2/2)"
