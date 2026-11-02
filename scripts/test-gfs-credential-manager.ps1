$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") { throw "windows_credential_manager_unavailable" }

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class GfsCredentialManagerRoundTrip {
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
    private static extern bool CredWrite(ref CREDENTIAL credential, uint flags);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredDelete(string target, uint type, uint flags);

    [DllImport("advapi32.dll", SetLastError = false)]
    private static extern void CredFree(IntPtr credential);

    public static void Write(string target, string userName, string secret) {
        var targetPtr = Marshal.StringToCoTaskMemUni(target);
        var userPtr = Marshal.StringToCoTaskMemUni(userName);
        var blob = Encoding.Unicode.GetBytes(secret);
        var blobPtr = Marshal.AllocCoTaskMem(blob.Length);
        try {
            Marshal.Copy(blob, 0, blobPtr, blob.Length);
            var credential = new CREDENTIAL {
                Type = 1,
                TargetName = targetPtr,
                CredentialBlob = blobPtr,
                CredentialBlobSize = (uint)blob.Length,
                Persist = 2,
                UserName = userPtr
            };
            if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error(), "credential_write_failed");
        } finally {
            Marshal.FreeCoTaskMem(targetPtr);
            Marshal.FreeCoTaskMem(userPtr);
            Marshal.FreeCoTaskMem(blobPtr);
        }
    }

    public static string[] Read(string target) {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer)) throw new Win32Exception(Marshal.GetLastWin32Error(), "credential_read_failed");
        try {
            var credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
            var user = credential.UserName == IntPtr.Zero ? "" : Marshal.PtrToStringUni(credential.UserName) ?? "";
            var secret = credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0
                ? ""
                : Marshal.PtrToStringUni(credential.CredentialBlob, checked((int)credential.CredentialBlobSize / 2)) ?? "";
            return new[] { user, secret };
        } finally {
            CredFree(pointer);
        }
    }

    public static void Delete(string target) {
        if (!CredDelete(target, 1, 0)) {
            var error = Marshal.GetLastWin32Error();
            if (error != 1168) throw new Win32Exception(error, "credential_delete_failed");
        }
    }
}
"@

$target = "GFS-GFS421-Dummy"
$expectedUser = "cb5066a6d71ecdee0bd7ed8aacb4d3c2"
$expectedSecret = "gfs421-dummy-secret"
try {
    [GfsCredentialManagerRoundTrip]::Write($target, $expectedUser, $expectedSecret)
    $values = [GfsCredentialManagerRoundTrip]::Read($target)
    if ($values[0] -ne $expectedUser -or $values[1] -ne $expectedSecret) { throw "credential_round_trip_mismatch" }
    $wrapper = Join-Path $PSScriptRoot "run-with-gfs-monitor-credentials.ps1"
    $envProbe = Join-Path $PSScriptRoot "test-gfs-credential-env.mjs"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $wrapper -NodeScript $envProbe -Target $target -AnalyticsTarget $target -ExpectedAnalyticsAccount $expectedUser
    if ($LASTEXITCODE -ne 0) { throw "credential_bridge_process_scope_failed" }
    Write-Output "credential_manager_dummy_round_trip PASS"
} finally {
    [GfsCredentialManagerRoundTrip]::Delete($target)
}

try {
    [void][GfsCredentialManagerRoundTrip]::Read($target)
    throw "credential_cleanup_failed"
} catch {
    if ($_.Exception.Message -notmatch "credential_read_failed|Element not found") { throw }
}
Write-Output "credential_manager_dummy_cleanup PASS"
