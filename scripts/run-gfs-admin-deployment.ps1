[CmdletBinding()]
param(
  [ValidateSet("Preflight", "Upload")]
  [string] $Mode = "Preflight",
  [Parameter(Mandatory = $true)]
  [string] $ApprovedGitSha,
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[a-f0-9]{64}$")]
  [string] $ExpectedArtifactSha256,
  [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")),
  [string] $CredentialTarget = "GFS-Admin-Deploy-Scoped-2026"
)

$ErrorActionPreference = "Stop"
$ExpectedAccount = "cb5066a6d71ecdee0bd7ed8aacb4d3c2"
$ExpectedWorker = "getfreeseeds-admin-staging"
$ExpectedUser = "bi\nazim"
$ConfigPath = Join-Path $RepoRoot "apps\admin\wrangler.jsonc"
$PreflightScript = Join-Path $PSScriptRoot "cloudflare-admin-deployment-preflight.mjs"
$LinkageScript = Join-Path $PSScriptRoot "verify-gfs-admin-token-linkage.ps1"
$WranglerScript = Join-Path $RepoRoot "node_modules\wrangler\bin\wrangler.js"
. (Join-Path $PSScriptRoot "admin-deployment-runner-validation.ps1")
. (Join-Path $PSScriptRoot "gfs-credential-reader.ps1")

function Fail([string] $Code) { throw $Code }

function Invoke-GfsNodeJson {
  param([Parameter(Mandatory = $true)][string[]] $Arguments)
  $output = (& node.exe @Arguments 2>$null | Out-String).Trim()
  $exitCode = $LASTEXITCODE
  if ([string]::IsNullOrWhiteSpace($output)) { return [pscustomobject]@{ result = "FAIL"; code = "invalid_response_shape"; exitCode = $exitCode } }
  try { $parsed = ($output | ConvertFrom-Json) } catch { return [pscustomobject]@{ result = "FAIL"; code = "invalid_response_shape"; exitCode = $exitCode } }
  if ($exitCode -ne 0 -and [string]$parsed.result -eq "PASS") { return [pscustomobject]@{ result = "FAIL"; code = "node_readback_failed"; exitCode = $exitCode } }
  return $parsed
}

function Get-GfsReadbackFailureCode([object] $Result) {
  $code = [string]$Result.code
  if ($code -notmatch '^[A-Za-z0-9_.:-]{1,64}$') { return "invalid_response_shape" }
  $parts = @($code)
  $httpStatus = 0
  if ([int]::TryParse([string]$Result.httpStatus, [ref]$httpStatus) -and $httpStatus -gt 0) { $parts += "http$httpStatus" }
  $providerCode = [string]$Result.providerErrorCode
  if ($providerCode -match '^cf_[0-9]+$') { $parts += $providerCode }
  return ($parts -join "_")
}

if ($env:OS -ne "Windows_NT") { Fail "windows_host_required" }
$identity = (whoami).Trim()
if ($identity.ToLowerInvariant() -ne $ExpectedUser.ToLowerInvariant()) { Fail "approved_identity_required" }

$resolvedRepo = (Resolve-Path $RepoRoot).Path
$gitRootResult = Invoke-GfsGitText -RepoRoot $resolvedRepo -Arguments @("rev-parse", "--show-toplevel")
if ($gitRootResult.exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($gitRootResult.text)) { Fail "git_repository_lookup_failed" }
$gitRoot = $gitRootResult.text
$headResult = Invoke-GfsGitText -RepoRoot $resolvedRepo -Arguments @("rev-parse", "HEAD")
if ($headResult.exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($headResult.text)) { Fail "git_head_lookup_failed" }
$head = $headResult.text
$dirtyResult = Invoke-GfsGitText -RepoRoot $resolvedRepo -Arguments @("status", "--porcelain")
if ($dirtyResult.exitCode -ne 0) { Fail "git_status_failed" }
$dirty = $dirtyResult.text

$digestJson = & node.exe $PreflightScript --artifact-digest --repo-root $resolvedRepo --config "apps/admin/wrangler.jsonc"
if ($LASTEXITCODE -ne 0) { Fail "artifact_digest_failed" }
$digest = $digestJson | ConvertFrom-Json
$inputCheck = Test-GfsRunnerInputs -Identity $identity -ExpectedIdentity $ExpectedUser -RepoRoot $resolvedRepo -GitRoot $gitRoot -ExpectedGitSha $ApprovedGitSha -ActualGitSha $head -WorktreeDirty ([bool]$dirty) -ExpectedArtifactSha256 $ExpectedArtifactSha256 -ActualArtifactSha256 $digest.sha256
if (-not $inputCheck.pass) { Fail $inputCheck.code }

$configText = Get-Content -Raw $ConfigPath
if ($configText -notmatch '"name"\s*:\s*"getfreeseeds-admin-staging"') { Fail "worker_config_mismatch" }
if ($configText -notmatch '"account_id"\s*:\s*"cb5066a6d71ecdee0bd7ed8aacb4d3c2"') { Fail "account_config_mismatch" }
if (-not (Test-Path -LiteralPath $WranglerScript)) { Fail "official_wrangler_missing" }

if (-not (Test-Path -LiteralPath $LinkageScript)) { Fail "token_linkage_verifier_missing" }

$linkageOutput = $null
$linkage = $null
$linkageCheck = $null
try {
  $windowsPowerShell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  if (-not (Test-Path -LiteralPath $windowsPowerShell)) { Fail "windows_powershell_missing" }
  $linkageOutput = (& $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $LinkageScript 2>$null | Out-String).Trim()
  $linkageExit = $LASTEXITCODE
  try { $linkage = $linkageOutput | ConvertFrom-Json } catch { Fail "cloudflare_token_linkage_unreadable" }
  $linkageCheck = Test-GfsTokenLinkageResult $linkage
  if ($linkageExit -ne 0 -or -not $linkageCheck.pass) {
    $safeCode = [string]$linkage.code
    if ($safeCode -notmatch '^[A-Za-z0-9_:-]{1,64}$') { $safeCode = $linkageCheck.code }
    $diagnosticCode = Get-GfsSafeLinkageDiagnosticCode -Diagnostics $linkage.diagnostics
    Fail ("cloudflare_token_linkage_" + $safeCode + "_" + $diagnosticCode)
  }
} finally {
  $linkageOutput = $null
  $linkage = $null
  $linkageCheck = $null
}

$secret = $null
$oldToken = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "Process")
$oldAccount = [Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "Process")
try {
  if ($CredentialTarget -ne "GFS-Admin-Deploy-Scoped-2026") { Fail "credential_target_not_allowlisted" }
  try { $secret = Read-GfsCredentialSecret $CredentialTarget } catch { Fail "credential_read_failed" }
  if ([string]::IsNullOrWhiteSpace($secret)) { Fail "credential_incomplete" }
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $secret, "Process")
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", $ExpectedAccount, "Process")

  $preflightOutput = & node.exe $PreflightScript --linkage-verified
  $preflightExit = $LASTEXITCODE
  $preflight = $preflightOutput | ConvertFrom-Json
  if ($preflightExit -ne 0 -or $preflight.result -ne "PASS") { Fail ("cloudflare_" + [string]$preflight.code) }

  if ($Mode -eq "Preflight") {
    [pscustomobject]@{ result = "PASS"; mode = "READ_ONLY_PREFLIGHT"; account = $ExpectedAccount; worker = $ExpectedWorker; gitSha = $ApprovedGitSha; artifactSha256 = $digest.sha256; artifactFiles = $digest.files; tokenStatus = $preflight.tokenStatus; expiresOn = $preflight.expiresOn; scope = $preflight.scope; workerReadback = $preflight.workerReadback } | ConvertTo-Json -Compress
    exit 0
  }

  $beforeDeployment = Invoke-GfsNodeJson @($PreflightScript, "--deployment-snapshot")
  $beforeVersions = Invoke-GfsNodeJson @($PreflightScript, "--versions-snapshot")
  if ([string]$beforeDeployment.result -ne "PASS") { Fail ("deployment_before_failed_" + (Get-GfsReadbackFailureCode $beforeDeployment)) }
  if ([string]$beforeVersions.result -ne "PASS") { Fail ("versions_before_failed_" + (Get-GfsReadbackFailureCode $beforeVersions)) }
  $uploadMessage = "GFS-COD-MO-90 $ApprovedGitSha $($digest.sha256)"
  $uploadTag = "gfs90-$ApprovedGitSha"
  $uploadStartedUtc = [DateTime]::UtcNow
  $uploadOutput = (& node.exe $WranglerScript versions upload --config $ConfigPath --name $ExpectedWorker --message $uploadMessage --tag $uploadTag 2>$null | Out-String).Trim()
  $uploadExit = $LASTEXITCODE
  if ($uploadExit -ne 0) { Fail "wrangler_versions_upload_failed" }
  $afterDeployment = Invoke-GfsNodeJson @($PreflightScript, "--deployment-snapshot")
  $afterVersions = Invoke-GfsNodeJson @($PreflightScript, "--versions-snapshot")
  if ([string]$afterDeployment.result -ne "PASS") { Fail ("deployment_after_failed_" + (Get-GfsReadbackFailureCode $afterDeployment)) }
  if ([string]$afterVersions.result -ne "PASS") { Fail ("versions_after_failed_" + (Get-GfsReadbackFailureCode $afterVersions)) }
  $readback = Test-GfsUploadedVersionReadback -BeforeDeployment $beforeDeployment -AfterDeployment $afterDeployment -BeforeVersions $beforeVersions -AfterVersions $afterVersions -Message $uploadMessage -Tag $uploadTag -UploadStartedUtc $uploadStartedUtc
  if (-not $readback.pass) { Fail $readback.code }
  [pscustomobject]@{ result = "PASS"; mode = "VERSIONS_UPLOAD_ONLY"; account = $ExpectedAccount; worker = $ExpectedWorker; gitSha = $ApprovedGitSha; artifactSha256 = $digest.sha256; versionId = $readback.versionId; deployed = $false; routingChanged = $false; tokenStatus = $preflight.tokenStatus; expiresOn = $preflight.expiresOn; scope = $preflight.scope } | ConvertTo-Json -Compress
} finally {
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $oldToken, "Process")
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", $oldAccount, "Process")
  $secret = $null
  $preflightOutput = $null
  $uploadOutput = $null
  $beforeDeployment = $null
  $afterDeployment = $null
  $beforeVersions = $null
  $afterVersions = $null
  $readback = $null
}
