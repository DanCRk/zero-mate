'use strict';

/**
 * tools/build-launcher.js
 * Compiles a native Windows subsystem executable (winexe, zero console window)
 * with the active theme's icon (themes/nier-2b/assets/yorha.ico) that launches
 * Electron in the background with ProcessWindowStyle.Hidden.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_EXE = path.join(ROOT, 'ZeroMate.exe');
const ICON_PATH = path.join(ROOT, 'themes', 'nier-2b', 'assets', 'yorha.ico');

const CS_SOURCE = `
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

[assembly: AssemblyTitle("ZeroMate Desktop Agent")]
[assembly: AssemblyProduct("ZeroMate")]
[assembly: AssemblyVersion("1.0.0.0")]

public static class Launcher {
  [STAThread]
  public static int Main(string[] args) {
    string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    string electron = Path.Combine(root, "node_modules", "electron", "dist", "electron.exe");
    if (!File.Exists(electron)) {
      return 1;
    }
    string argStr = "\\"" + root + "\\"";
    if (args != null && args.Length > 0) {
      argStr += " " + string.Join(" ", args);
    }
    ProcessStartInfo psi = new ProcessStartInfo {
      FileName = electron,
      Arguments = argStr,
      WorkingDirectory = root,
      UseShellExecute = false,
      CreateNoWindow = true,
      WindowStyle = ProcessWindowStyle.Hidden
    };
    Process.Start(psi);
    return 0;
  }
}
`;

function main() {
  const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
  const tempCs = path.join(__dirname, '_launcher.cs');
  fs.writeFileSync(tempCs, CS_SOURCE, 'utf8');
  try {
    const args = [
      '/nologo',
      '/target:winexe',
      '/optimize+',
      `/out:${OUT_EXE}`,
    ];
    if (fs.existsSync(ICON_PATH)) {
      args.push(`/win32icon:${ICON_PATH}`);
    }
    args.push(tempCs);
    execFileSync(csc, args, { stdio: 'inherit' });
    console.log(`[OK] Compiled silent launcher: ${OUT_EXE}`);

    // Remove legacy executables if present
    for (const old of ['YoRHa-Agent.exe', 'YoRHaAgent.exe', 'YoRHa-Agent.lnk']) {
      const p = path.join(ROOT, old);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }

    // Create shortcut
    const ps = `
      $WshShell = New-Object -ComObject WScript.Shell
      $s = $WshShell.CreateShortcut('${path.join(ROOT, 'ZeroMate.lnk').replace(/\\/g, '\\\\')}')
      $s.TargetPath = '${path.join(ROOT, 'ZeroMate.exe').replace(/\\/g, '\\\\')}'
      $s.WorkingDirectory = '${ROOT.replace(/\\/g, '\\\\')}'
      $s.IconLocation = '${ICON_PATH.replace(/\\/g, '\\\\')}'
      $s.Description = 'ZeroMate Desktop Agent'
      $s.Save()
    `;
    spawnSync('powershell.exe', ['-NoProfile', '-Command', ps]);
    console.log(`[OK] Generated Windows shortcut: ZeroMate.lnk`);
  } finally {
    try { fs.unlinkSync(tempCs); } catch {}
  }
}

if (require.main === module) {
  main();
}
