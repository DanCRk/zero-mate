'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'themes', 'nier-2b', 'assets');

const PS_SCRIPT = `
param([string]$AssetsDir)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;

public static class ExtendedSpriteGen {
  public static void GeneratePeek(string srcFull, string dstPeek) {
    using (Bitmap src = new Bitmap(srcFull)) {
      int w = src.Width, h = src.Height;
      using (Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        using (Graphics g = Graphics.FromImage(dst)) {
          g.SmoothingMode = SmoothingMode.HighQuality;
          g.InterpolationMode = InterpolationMode.HighQualityBicubic;
          g.PixelOffsetMode = PixelOffsetMode.HighQuality;
          g.Clear(Color.Transparent);

          // We want 2B leaning in from the left edge (x: 0), head and torso peeking out
          // Lower body from y=240 down is tucked behind the vertical border
          // We draw the full upper body tilted ~10 degrees
          GraphicsState state = g.Save();
          g.TranslateTransform(70, 160);
          g.RotateTransform(9.5f);
          g.TranslateTransform(-130, -160);

          // Draw upper body and head
          Rectangle srcUpper = new Rectangle(0, 0, w, 280);
          g.DrawImage(src, srcUpper, srcUpper, GraphicsUnit.Pixel);

          // Skirt flow
          Rectangle srcSkirt = new Rectangle(50, 220, w - 100, 120);
          g.DrawImage(src, srcSkirt, srcSkirt, GraphicsUnit.Pixel);
          g.Restore(state);

          // Draw the black-gloved hand gripping the vertical border at x=28, y=140
          using (SolidBrush gloveBrush = new SolidBrush(Color.FromArgb(250, 24, 23, 22)))
          using (Pen gloveOutline = new Pen(Color.FromArgb(200, 218, 212, 187), 1.5f)) {
            // Palm / fingers gripping vertical post
            g.FillEllipse(gloveBrush, 18, 130, 22, 28);
            g.DrawEllipse(gloveOutline, 18, 130, 22, 28);
            // Fingers curling around edge
            g.FillEllipse(gloveBrush, 28, 134, 10, 8);
            g.FillEllipse(gloveBrush, 28, 142, 11, 8);
            g.FillEllipse(gloveBrush, 28, 150, 10, 8);
          }
        }
        dst.Save(dstPeek, ImageFormat.Png);
      }
    }
  }

  public static void GenerateSleep(string srcSit, string dstSleep) {
    using (Bitmap src = new Bitmap(srcSit)) {
      int w = src.Width, h = src.Height;
      using (Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        using (Graphics g = Graphics.FromImage(dst)) {
          g.SmoothingMode = SmoothingMode.HighQuality;
          g.InterpolationMode = InterpolationMode.HighQualityBicubic;
          g.PixelOffsetMode = PixelOffsetMode.HighQuality;
          g.Clear(Color.Transparent);

          // Body from neck down (y >= 85)
          Rectangle bodyRect = new Rectangle(0, 85, w, h - 85);
          g.DrawImage(src, bodyRect, bodyRect, GraphicsUnit.Pixel);

          // Head region (y: 10 to 92) pitched down and tilted forward peacefully
          GraphicsState state = g.Save();
          g.TranslateTransform(130, 85);
          g.RotateTransform(6.0f); // tilted down
          g.TranslateTransform(-130, -73); // dropped by 12px

          Rectangle headRect = new Rectangle(0, 0, w, 92);
          g.DrawImage(src, headRect, headRect, GraphicsUnit.Pixel);
          g.Restore(state);

          // Soft standby visor glow reduction overlay
          using (SolidBrush sleepDim = new SolidBrush(Color.FromArgb(50, 20, 20, 20))) {
            g.FillEllipse(sleepDim, 105, 52, 50, 24);
          }
        }
        dst.Save(dstSleep, ImageFormat.Png);
      }
    }
  }

  public static void GenerateBunkerSatellite(string dstBunker) {
    int w = 240, h = 120;
    using (Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
      using (Graphics g = Graphics.FromImage(dst)) {
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.Clear(Color.Transparent);

        Color charcoal = Color.FromArgb(255, 26, 25, 23);
        Color ivory = Color.FromArgb(255, 218, 212, 187);
        Color ivoryMuted = Color.FromArgb(255, 158, 152, 130);
        Color gold = Color.FromArgb(255, 216, 184, 104);
        Color panelBlue = Color.FromArgb(255, 42, 48, 56);

        using (SolidBrush charcBrush = new SolidBrush(charcoal))
        using (SolidBrush ivoryBrush = new SolidBrush(ivory))
        using (SolidBrush goldBrush = new SolidBrush(gold))
        using (SolidBrush blueBrush = new SolidBrush(panelBlue))
        using (Pen ivoryPen = new Pen(ivory, 1.5f))
        using (Pen goldPen = new Pen(gold, 1.2f))
        using (Pen dimPen = new Pen(ivoryMuted, 1f)) {
          // 1. Solar Wing Struts
          g.DrawLine(ivoryPen, 20, 60, 220, 60);
          g.DrawLine(dimPen, 30, 50, 210, 50);
          g.DrawLine(dimPen, 30, 70, 210, 70);

          // 2. Solar Panels Left & Right
          // Left wing
          g.FillRectangle(blueBrush, 24, 42, 60, 36);
          g.DrawRectangle(ivoryPen, 24, 42, 60, 36);
          for (int x = 36; x < 84; x += 12) g.DrawLine(dimPen, x, 42, x, 78);
          g.DrawLine(goldPen, 24, 60, 84, 60);

          // Right wing
          g.FillRectangle(blueBrush, 156, 42, 60, 36);
          g.DrawRectangle(ivoryPen, 156, 42, 60, 36);
          for (int x = 168; x < 216; x += 12) g.DrawLine(dimPen, x, 42, x, 78);
          g.DrawLine(goldPen, 156, 60, 216, 60);

          // 3. Rotating Habitat Ring (Octagonal Silhouette)
          Point[] ringPoints = new Point[] {
            new Point(120, 16), new Point(144, 28), new Point(152, 60), new Point(144, 92),
            new Point(120, 104), new Point(96, 92), new Point(88, 60), new Point(96, 28)
          };
          g.DrawPolygon(new Pen(ivory, 2f), ringPoints);
          g.DrawEllipse(dimPen, 98, 38, 44, 44);

          // Ring connecting spokes
          g.DrawLine(dimPen, 120, 16, 120, 104);
          g.DrawLine(dimPen, 88, 60, 152, 60);

          // 4. Central Command Core Hub
          Point[] hubPoints = new Point[] {
            new Point(120, 32), new Point(136, 44), new Point(136, 76),
            new Point(120, 88), new Point(104, 76), new Point(104, 44)
          };
          g.FillPolygon(charcBrush, hubPoints);
          g.DrawPolygon(ivoryPen, hubPoints);

          // Inner command eye & telemetry beacon
          g.FillEllipse(goldBrush, 114, 54, 12, 12);
          g.FillEllipse(new SolidBrush(Color.White), 117, 57, 6, 6);

          // 5. Forward Array / Sensor Spire
          g.DrawLine(goldPen, 120, 16, 120, 4);
          g.FillEllipse(goldBrush, 118, 2, 4, 4);

          // 6. Communication Dish
          g.DrawArc(ivoryPen, 110, 88, 20, 16, 0, 180);
          g.DrawLine(goldPen, 120, 96, 120, 112);
          g.FillEllipse(goldBrush, 118, 110, 4, 4);
        }
      }
      dst.Save(dstBunker, ImageFormat.Png);
    }
  }
}
"@

[ExtendedSpriteGen]::GeneratePeek(
  (Join-Path $AssetsDir '2b-full.png'),
  (Join-Path $AssetsDir '2b-peek.png')
)
Write-Host '[OK] Generated 2b-peek.png'

[ExtendedSpriteGen]::GenerateSleep(
  (Join-Path $AssetsDir '2b-sit.png'),
  (Join-Path $AssetsDir '2b-sleep.png')
)
Write-Host '[OK] Generated 2b-sleep.png'

[ExtendedSpriteGen]::GenerateBunkerSatellite(
  (Join-Path $AssetsDir 'bunker-satellite.png')
)
Write-Host '[OK] Generated bunker-satellite.png'
`;

function main() {
  const tmpScript = path.join(ROOT, 'tools', '_gen_sprites.ps1');
  fs.writeFileSync(tmpScript, PS_SCRIPT, 'utf8');
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScript, '-AssetsDir', ASSETS_DIR], {
      encoding: 'utf8',
    });
    console.log(out.trim());
  } finally {
    try { fs.unlinkSync(tmpScript); } catch {}
  }
}

main();
