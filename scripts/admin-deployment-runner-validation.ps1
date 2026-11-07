function Get-GfsCanonicalPath {
  param([Parameter(Mandatory = $true)][string] $Path)
  $full = [System.IO.Path]::GetFullPath($Path)
  return $full.TrimEnd([char]0x5c, [char]0x2f).ToUpperInvariant()
}

function Test-GfsCanonicalPathEqual {
  param([Parameter(Mandatory = $true)][string] $Left, [Parameter(Mandatory = $true)][string] $Right)
  return (Get-GfsCanonicalPath $Left) -ceq (Get-GfsCanonicalPath $Right)
}

function Invoke-GfsGitText {
  param([Parameter(Mandatory = $true)][string] $RepoRoot, [Parameter(Mandatory = $true)][string[]] $Arguments)
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $lines = @(& git -c core.excludesfile= -C $RepoRoot @Arguments 2>$null)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  $text = (@($lines) -join [Environment]::NewLine).Trim()
  return [pscustomobject]@{ exitCode = $exitCode; text = $text }
}

function Test-GfsRunnerInputs {
  param(
    [Parameter(Mandatory = $true)][string] $Identity,
    [Parameter(Mandatory = $true)][string] $ExpectedIdentity,
    [Parameter(Mandatory = $true)][string] $RepoRoot,
    [Parameter(Mandatory = $true)][string] $GitRoot,
    [Parameter(Mandatory = $true)][string] $ExpectedGitSha,
    [Parameter(Mandatory = $true)][string] $ActualGitSha,
    [Parameter(Mandatory = $true)][bool] $WorktreeDirty,
    [Parameter(Mandatory = $true)][string] $ExpectedArtifactSha256,
    [Parameter(Mandatory = $true)][string] $ActualArtifactSha256
  )
  if ($Identity.ToLowerInvariant() -ne $ExpectedIdentity.ToLowerInvariant()) { return [pscustomobject]@{ pass = $false; code = "approved_identity_required" } }
  if (-not (Test-GfsCanonicalPathEqual $RepoRoot $GitRoot)) { return [pscustomobject]@{ pass = $false; code = "repository_mismatch" } }
  if ($ActualGitSha -ne $ExpectedGitSha) { return [pscustomobject]@{ pass = $false; code = "approved_git_sha_mismatch" } }
  if ($WorktreeDirty) { return [pscustomobject]@{ pass = $false; code = "worktree_not_clean" } }
  if ($ActualArtifactSha256.ToLowerInvariant() -ne $ExpectedArtifactSha256.ToLowerInvariant()) { return [pscustomobject]@{ pass = $false; code = "approved_artifact_mismatch" } }
  return [pscustomobject]@{ pass = $true; code = "none" }
}

function Test-GfsCredentialState {
  param([Parameter(Mandatory = $true)][bool] $Available)
  if (-not $Available) { return [pscustomobject]@{ pass = $false; code = "credential_read_failed" } }
  return [pscustomobject]@{ pass = $true; code = "none" }
}

function Test-GfsTokenLinkageResult {
  param([Parameter(Mandatory = $true)][object] $Result)
  if ($null -eq $Result) { return [pscustomobject]@{ pass = $false; code = "token_linkage_result_missing" } }
  if ([string]$Result.result -ne "PASS") { return [pscustomobject]@{ pass = $false; code = "token_linkage_not_passed" } }
  if ([string]$Result.token_identity_match -ne "PASS") { return [pscustomobject]@{ pass = $false; code = "token_identity_unverified" } }
  if ([string]$Result.tokenStatus -ne "ACTIVE") { return [pscustomobject]@{ pass = $false; code = "token_not_active" } }
  if ([string]$Result.expiry_status -ne "VALID") { return [pscustomobject]@{ pass = $false; code = "token_expiry_unverified" } }
  if ([string]$Result.scope -ne "VERIFIED") { return [pscustomobject]@{ pass = $false; code = "token_scope_unverified" } }
  if ([string]$Result.code -ne "none") { return [pscustomobject]@{ pass = $false; code = "token_linkage_code_unexpected" } }
  return [pscustomobject]@{ pass = $true; code = "none" }
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
