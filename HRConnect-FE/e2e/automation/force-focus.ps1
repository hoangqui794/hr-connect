Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class WindowFocuser {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static void BringAllChromeWindowsToFront() {
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetClassName(hWnd, sb, 256);
                string cls = sb.ToString();
                if (cls == "Chrome_WidgetWin_1") {
                    ShowWindow(hWnd, 3); // SW_MAXIMIZE
                    keybd_event(0x12, 0, 0, 0); // Alt down
                    SetForegroundWindow(hWnd);
                    keybd_event(0x12, 0, 2, 0); // Alt up
                    SetWindowPos(hWnd, new IntPtr(-1), 0, 0, 0, 0, 0x0043); // Topmost
                }
            }
            return true;
        }, IntPtr.Zero);
    }
}
"@ -ErrorAction SilentlyContinue

[WindowFocuser]::BringAllChromeWindowsToFront()
