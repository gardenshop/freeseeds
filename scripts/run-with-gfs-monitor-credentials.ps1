param(
  [Parameter(Mandatory = $true)]
  [string] $NodeScript,
  [string[]] $NodeArgs = @(),
  [string] $Target = "GFS-Admin-Health-Monitor"
)

$ErrorActionPreference = "Stop"

if (-not $IsWindows -and $env:OS -ne "Windows_NT") { throw "windows_credential_manager_unavailable" }

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class GfsCredentialManager {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);

    [DllImport("advapi32.dll", SetLastError = false)]
    private static extern void CredFree(IntPtr credential);

    public static string[] Read(string target) {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer)) throw new Win32Exception(Marshal.GetLastWin32Error(), "credential_read_failed");
        try {
            var credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
            var userName = credential.UserName == IntPtr.Zero ? "" : Marshal.PtrToStringUni(credential.UserName) ?? "";
            var secret = "";
            if (credential.CredentialBlob != IntPtr.Zero && credential.CredentialBlobSize > 0) {
                secret = Marshal.PtrToStringUni(credential.CredentialBlob, checked((int)credential.CredentialBlobSize / 2)) ?? "";
            }
            return new[] { userName, secret };
        } finally {
            CredFree(pointer);
        }
    }
}
"@

$values = [GfsCredentialManager]::Read($Target)
if ([string]::IsNullOrEmpty($values[0]) -or [string]::IsNullOrEmpty($values[1])) { throw "credential_incomplete" }

$idName = "GFS_ACCESS_CLIENT_ID"
$secretName = "GFS_ACCESS_CLIENT_SECRET"
$oldId = [Environment]::GetEnvironmentVariable($idName, "Process")
$oldSecret = [Environment]::GetEnvironmentVariable($secretName, "Process")
try {
    [Environment]::SetEnvironmentVariable($idName, $values[0], "Process")
    [Environment]::SetEnvironmentVariable($secretName, $values[1], "Process")
    & node.exe $NodeScript @NodeArgs
    $exitCode = $LASTEXITCODE
} finally {
    [Environment]::SetEnvironmentVariable($idName, $oldId, "Process")
    [Environment]::SetEnvironmentVariable($secretName, $oldSecret, "Process")
    $values = $null
}
exit $exitCode
