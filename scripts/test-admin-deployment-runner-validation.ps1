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
$cleanStatus = Invoke-GfsGitText -RepoRoot $root -Arguments @("status", "--porcelain")
if ($cleanStatus.exitCode -ne 0 -or $null -eq $cleanStatus.text) { throw "git status did not produce safe text" }
$actualRoot = Invoke-GfsGitText -RepoRoot $root -Arguments @("rev-parse", "--show-toplevel")
if ($actualRoot.exitCode -ne 0 -or -not (Test-GfsCanonicalPathEqual $root $actualRoot.text)) { throw "actual git root lookup failed" }
$invalidGit = Invoke-GfsGitText -RepoRoot "D:\not-a-repository" -Arguments @("status", "--porcelain")
if ($invalidGit.exitCode -eq 0) { throw "invalid repository unexpectedly passed" }
$runnerSource = Get-Content -Raw (Join-Path $PSScriptRoot "gfs-credential-reader.ps1")
$csharpMatch = [regex]::Match($runnerSource, 'Add-Type\s+-TypeDefinition\s+@"\r?\n(?<source>.*?)\r?\n"@', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $csharpMatch.Success) { throw "embedded C# source not found" }
for ($i = 0; $i -lt 2; $i++) {
  $className = "GfsAdminCredentialReaderRuntimeTest$i"
  $csharp = $csharpMatch.Groups["source"].Value.Replace("GfsAdminCredentialReader", $className)
  $compiledType = Add-Type -TypeDefinition $csharp -PassThru
  if ($null -eq $compiledType) { throw "embedded C# compilation returned no type" }
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
$validLinkage = [pscustomobject]@{ result = "PASS"; token_identity_match = "PASS"; tokenStatus = "ACTIVE"; expiry_status = "VALID"; scope = "VERIFIED"; code = "none" }
Assert-Pass (Test-GfsTokenLinkageResult $validLinkage) "valid token linkage result"
Assert-Code (Test-GfsTokenLinkageResult ([pscustomobject]@{ result = "FAIL"; token_identity_match = "UNKNOWN"; tokenStatus = "UNKNOWN"; expiry_status = "UNKNOWN"; scope = "UNVERIFIED"; code = "METADATA_AUTH_REQUIRED" })) "token_linkage_not_passed" "metadata unavailable"
Assert-Code (Test-GfsTokenLinkageResult ([pscustomobject]@{ result = "PASS"; token_identity_match = "PASS"; tokenStatus = "ACTIVE"; expiry_status = "VALID"; scope = "UNVERIFIED"; code = "none" })) "token_scope_unverified" "scope unavailable"
$safeLinkage = $validLinkage | ConvertTo-Json -Compress
if ($safeLinkage -match "synthetic-secret|CLOUDFLARE_API_TOKEN|0123456789abcdef") { throw "token linkage output leaked sensitive data" }
"runner_validation=PASS (11/11); linkage_gate=PASS (3/3); credential_reader_add_type=PASS (2/2)"
