param(
  [string] $Target = "GFS-Admin-Deploy-Scoped-2026"
)

$ErrorActionPreference = "Stop"
if ($env:OS -ne "Windows_NT") { throw "windows_credential_manager_unavailable" }
if ($Target -ne "GFS-Admin-Deploy-Scoped-2026") { throw "credential_target_not_allowlisted" }

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class GfsWatchdogCredentialReader {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL {
        public uint Flags; public uint Type; public IntPtr TargetName; public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
        public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName;
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll", SetLastError = false)]
    private static extern void CredFree(IntPtr credential);
    public static string ReadSecret(string target) {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer)) throw new Win32Exception(Marshal.GetLastWin32Error(), "credential_read_failed");
        try {
            var credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
            if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0) throw new InvalidOperationException("credential_incomplete");
            return Marshal.PtrToStringUni(credential.CredentialBlob, checked((int)credential.CredentialBlobSize / 2)) ?? throw new InvalidOperationException("credential_incomplete");
        } finally { CredFree(pointer); }
    }
}
"@

$old = [Environment]::GetEnvironmentVariable("GFS_WATCHDOG_ADMIN_TOKEN", "Process")
$secret = $null
try {
    $secret = [GfsWatchdogCredentialReader]::ReadSecret($Target)
    [Environment]::SetEnvironmentVariable("GFS_WATCHDOG_ADMIN_TOKEN", $secret, "Process")
    & node.exe (Join-Path $PSScriptRoot "cloudflare-watchdog-secret-inject.mjs")
    $exitCode = $LASTEXITCODE
} finally {
    [Environment]::SetEnvironmentVariable("GFS_WATCHDOG_ADMIN_TOKEN", $old, "Process")
    $secret = $null
}
exit $exitCode
