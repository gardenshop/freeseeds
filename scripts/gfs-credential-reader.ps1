$ErrorActionPreference = "Stop"

function Initialize-GfsCredentialReader {
  if ($null -ne ("GfsAdminCredentialReader" -as [type])) { return }
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
}

function Read-GfsCredentialSecret {
  param([Parameter(Mandatory = $true)][string] $Target)
  Initialize-GfsCredentialReader
  return [GfsAdminCredentialReader]::ReadSecret($Target)
}
