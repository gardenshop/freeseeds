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
$WranglerScript = Join-Path $RepoRoot "node_modules\wrangler\bin\wrangler.js"
. (Join-Path $PSScriptRoot "admin-deployment-runner-validation.ps1")

function Fail([string] $Code) { throw $Code }

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

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class GfsAdminCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct CREDENTIAL { public uint Flags; public uint Type; public IntPtr TargetName; public IntPtr Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist; public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName; }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll", SetLastError = false)] private static extern void CredFree(IntPtr credential);
  public static string ReadSecret(string target) { IntPtr pointer; if (!CredRead(target, 1, 0, out pointer)) throw new Win32Exception(Marshal.GetLastWin32Error(), "credential_read_failed"); try { var c = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL)); if (c.CredentialBlob == IntPtr.Zero || c.CredentialBlobSize == 0) throw new InvalidOperationException("credential_incomplete"); string value = Marshal.PtrToStringUni(c.CredentialBlob, checked((int)c.CredentialBlobSize / 2)); if (value == null) throw new InvalidOperationException("credential_incomplete"); return value; } finally { CredFree(pointer); } }
}
"@

$secret = $null
$oldToken = [Environment]::GetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "Process")
$oldAccount = [Environment]::GetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "Process")
try {
  if ($CredentialTarget -ne "GFS-Admin-Deploy-Scoped-2026") { Fail "credential_target_not_allowlisted" }
  try { $secret = [GfsAdminCredentialReader]::ReadSecret($CredentialTarget) } catch { Fail "credential_read_failed" }
  if ([string]::IsNullOrWhiteSpace($secret)) { Fail "credential_incomplete" }
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $secret, "Process")
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", $ExpectedAccount, "Process")

  $preflightOutput = & node.exe $PreflightScript
  $preflightExit = $LASTEXITCODE
  $preflight = $preflightOutput | ConvertFrom-Json
  if ($preflightExit -ne 0 -or $preflight.result -ne "PASS") { Fail ("cloudflare_" + [string]$preflight.code) }

  if ($Mode -eq "Preflight") {
    [pscustomobject]@{ result = "PASS"; mode = "READ_ONLY_PREFLIGHT"; account = $ExpectedAccount; worker = $ExpectedWorker; gitSha = $ApprovedGitSha; artifactSha256 = $digest.sha256; artifactFiles = $digest.files; tokenStatus = $preflight.tokenStatus; expiresOn = $preflight.expiresOn; scope = $preflight.scope; workerReadback = $preflight.workerReadback } | ConvertTo-Json -Compress
    exit 0
  }

  $uploadOutput = (& node.exe $WranglerScript versions upload --config $ConfigPath --name $ExpectedWorker --message ("GFS-COD-MO-76 " + $ApprovedGitSha) --json 2>&1 | Out-String)
  $uploadExit = $LASTEXITCODE
  $versionMatch = [regex]::Match($uploadOutput, "(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b")
  if ($uploadExit -ne 0) { Fail "wrangler_versions_upload_failed" }
  if (-not $versionMatch.Success) { Fail "uploaded_version_id_missing" }
  [pscustomobject]@{ result = "PASS"; mode = "VERSIONS_UPLOAD_ONLY"; account = $ExpectedAccount; worker = $ExpectedWorker; gitSha = $ApprovedGitSha; artifactSha256 = $digest.sha256; versionId = $versionMatch.Value; deployed = $false; routingChanged = $false; tokenStatus = $preflight.tokenStatus; expiresOn = $preflight.expiresOn; scope = $preflight.scope } | ConvertTo-Json -Compress
} finally {
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $oldToken, "Process")
  [Environment]::SetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", $oldAccount, "Process")
  $secret = $null
  $preflightOutput = $null
  $uploadOutput = $null
}
