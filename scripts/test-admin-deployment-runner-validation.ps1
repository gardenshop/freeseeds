$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "admin-deployment-runner-validation.ps1")

$sha = "a" * 40
$digest = "b" * 64
$root = "D:\free seeds\gfs264-pr11"
$base = @{
  Identity = "bi\nazim"; ExpectedIdentity = "bi\nazim"; RepoRoot = $root; GitRoot = $root;
  ExpectedGitSha = $sha; ActualGitSha = $sha; WorktreeDirty = $false;
  ExpectedArtifactSha256 = $digest; ActualArtifactSha256 = $digest
}
function Assert-Pass($value, [string]$name) { if (-not $value.pass) { throw "$name expected PASS, got $($value.code)" } }
function Assert-Code($value, [string]$expected, [string]$name) { if ($value.pass -or $value.code -ne $expected) { throw "$name expected $expected" } }
function Invoke-Case($overrides = @{}) { $case = $base.Clone(); foreach ($key in $overrides.Keys) { $case[$key] = $overrides[$key] }; return (Test-GfsRunnerInputs @case) }

Assert-Pass (Invoke-Case) "canonical path"
Assert-Pass (Invoke-Case @{ RepoRoot = "d:/FREE SEEDS/gfs264-pr11"; GitRoot = "D:\free seeds\gfs264-pr11" }) "separator/case path"
Assert-Code (Invoke-Case @{ GitRoot = "D:\other\repo" }) "repository_mismatch" "different repository"
Assert-Code (Invoke-Case @{ Identity = "bi\codexsandboxoffline" }) "approved_identity_required" "wrong identity"
Assert-Code (Invoke-Case @{ ActualGitSha = ("c" * 40) }) "approved_git_sha_mismatch" "wrong SHA"
Assert-Code (Invoke-Case @{ WorktreeDirty = $true }) "worktree_not_clean" "dirty worktree"
Assert-Code (Invoke-Case @{ ActualArtifactSha256 = ("c" * 64) }) "approved_artifact_mismatch" "wrong artifact"
Assert-Code (Test-GfsCredentialState -Available $false) "credential_read_failed" "missing credential"
$safeOutput = (Test-GfsRunnerInputs @base | ConvertTo-Json -Compress) + (Test-GfsCredentialState -Available $false | ConvertTo-Json -Compress)
if ($safeOutput -match "synthetic-secret|CLOUDFLARE_API_TOKEN") { throw "secret leaked in validation output" }
"runner_validation=PASS (9/9)"
