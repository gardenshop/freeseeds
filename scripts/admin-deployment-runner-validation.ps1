function Get-GfsCanonicalPath {
  param([Parameter(Mandatory = $true)][string] $Path)
  $full = [System.IO.Path]::GetFullPath($Path)
  return $full.TrimEnd([char]0x5c, [char]0x2f).ToUpperInvariant()
}

function Test-GfsCanonicalPathEqual {
  param([Parameter(Mandatory = $true)][string] $Left, [Parameter(Mandatory = $true)][string] $Right)
  return (Get-GfsCanonicalPath $Left) -ceq (Get-GfsCanonicalPath $Right)
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
