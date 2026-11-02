Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WindowHelper {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@ -ErrorAction SilentlyContinue

$procs = Get-Process chrome, msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }
foreach ($p in $procs) {
    [WindowHelper]::ShowWindow($p.MainWindowHandle, 3) # SW_MAXIMIZE
    [WindowHelper]::SetWindowPos($p.MainWindowHandle, [IntPtr]::new(-1), 0, 0, 0, 0, 0x0043)
    [WindowHelper]::SetForegroundWindow($p.MainWindowHandle)
}
