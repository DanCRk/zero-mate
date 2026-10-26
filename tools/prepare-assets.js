'use strict';

/**
 * tools/prepare-assets.js
 * Copies raw generated assets into themes/nier-2b/assets/raw/ and runs high-precision
 * chroma-key background removal, green spill suppression, bounding-box normalization,
 * and icon generation into themes/nier-2b/assets/.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'themes', 'nier-2b', 'assets');
const RAW_DIR = path.join(ASSETS_DIR, 'raw');
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || process.argv[2] || RAW_DIR;

const RAW_SOURCES = {
  '2b-full.png': '2b_full_1792969083594.jpg',
  'pod-042.png': 'pod_042_1792969097851.jpg',
  'katana.png': 'katana_1792969115423.jpg',
  'cutin-slash.png': 'cutin_slash_1792969136803.jpg',
  'cutin-eyes.png': 'cutin_eyes_1792969158885.jpg',
  'portrait-2b.png': 'portrait_2b_1792969178796.jpg',
  'portrait-pod.png': 'portrait_pod_1792969201047.jpg',
};

const PS_SCRIPT = `
param([string]$RawDir, [string]$OutDir)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class SpriteProcessor {
  public static Bitmap ChromaKey(Bitmap src, int threshold, int ramp) {
    int w = src.Width, h = src.Height;
    Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.DrawImage(src, 0, 0, w, h);
    }
    Rectangle rect = new Rectangle(0, 0, w, h);
    BitmapData data = dst.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int bytes = Math.Abs(data.Stride) * h;
    byte[] buf = new byte[bytes];
    Marshal.Copy(data.Scan0, buf, 0, bytes);

    // Flood-fill mask from borders so internal bright details stay intact, plus global high-green key
    for (int i = 0; i < bytes; i += 4) {
      int b = buf[i];
      int g = buf[i + 1];
      int r = buf[i + 2];
      int a = buf[i + 3];
      int maxRB = r > b ? r : b;
      int excess = g - maxRB;

      if (excess > threshold && g > 85) {
        if (excess >= threshold + ramp) {
          buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
        } else {
          float k = 1.0f - (float)(excess - threshold) / (float)ramp;
          int na = (int)(255.0f * k);
          int ng = Math.Min(g, maxRB + 6);
          buf[i + 1] = (byte)ng;
          buf[i + 3] = (byte)Math.Min(a, na);
        }
      } else if (excess > 10 && g > 95) {
        int ng = (int)(g - (excess - 10) * 0.8f);
        buf[i + 1] = (byte)Math.Max(0, Math.Min(255, ng));
      }
    }

    Marshal.Copy(buf, 0, data.Scan0, bytes);
    dst.UnlockBits(data);
    return dst;
  }

  public static Rectangle AlphaBounds(Bitmap bmp, int minAlpha) {
    int w = bmp.Width, h = bmp.Height;
    BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int bytes = Math.Abs(data.Stride) * h;
    byte[] buf = new byte[bytes];
    Marshal.Copy(data.Scan0, buf, 0, bytes);
    bmp.UnlockBits(data);

    int minX = w, minY = h, maxX = 0, maxY = 0;
    for (int y = 0; y < h; y++) {
      int row = y * data.Stride;
      for (int x = 0; x < w; x++) {
        int a = buf[row + x * 4 + 3];
        if (a >= minAlpha) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return new Rectangle(0, 0, w, h);
    return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
  }

  public static Bitmap ResizeFitted(Bitmap src, Rectangle crop, int canvasW, int canvasH, int padTop, int padBottom) {
    Bitmap dst = new Bitmap(canvasW, canvasH, PixelFormat.Format32bppArgb);
    int availH = canvasH - padTop - padBottom;
    double scale = (double)availH / (double)crop.Height;
    int drawW = (int)Math.Round(crop.Width * scale);
    int drawH = availH;
    if (drawW > canvasW - 8) {
      scale = (double)(canvasW - 8) / (double)crop.Width;
      drawW = canvasW - 8;
      drawH = (int)Math.Round(crop.Height * scale);
    }
    int dx = (canvasW - drawW) / 2;
    int dy = canvasH - padBottom - drawH;

    using (Graphics g = Graphics.FromImage(dst)) {
      g.Clear(Color.Transparent);
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.DrawImage(src, new Rectangle(dx, dy, drawW, drawH), crop, GraphicsUnit.Pixel);
    }
    return dst;
  }

  public static Bitmap ResizeExact(Bitmap src, int w, int h) {
    Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.Clear(Color.Transparent);
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.DrawImage(src, new Rectangle(0, 0, w, h));
    }
    return dst;
  }

  public static void WriteIco(Bitmap bmp, string outPath) {
    using (Bitmap iconBmp = ResizeExact(bmp, 64, 64))
    using (MemoryStream msPng = new MemoryStream()) {
      iconBmp.Save(msPng, ImageFormat.Png);
      byte[] pngBytes = msPng.ToArray();
      using (FileStream fs = new FileStream(outPath, FileMode.Create))
      using (BinaryWriter bw = new BinaryWriter(fs)) {
        bw.Write((short)0);   // reserved
        bw.Write((short)1);   // type: 1 = ICO
        bw.Write((short)1);   // count: 1 image
        bw.Write((byte)64);   // width
        bw.Write((byte)64);   // height
        bw.Write((byte)0);    // colors
        bw.Write((byte)0);    // reserved
        bw.Write((short)1);   // planes
        bw.Write((short)32);  // bpp
        bw.Write((int)pngBytes.Length);
        bw.Write((int)22);    // offset
        bw.Write(pngBytes);
      }
    }
  }
}
"@

function Process-Cutout([string]$inFile, [string]$outFile, [int]$w, [int]$h, [int]$padTop, [int]$padBottom) {
  $src = [System.Drawing.Bitmap]::new($inFile)
  $keyed = [SpriteProcessor]::ChromaKey($src, 30, 48)
  $bounds = [SpriteProcessor]::AlphaBounds($keyed, 40)
  $final = [SpriteProcessor]::ResizeFitted($keyed, $bounds, $w, $h, $padTop, $padBottom)
  $final.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host ("  [OK] {0} -> {1}x{2} (crop {3}x{4})" -f (Split-Path $outFile -Leaf), $w, $h, $bounds.Width, $bounds.Height)
  $final.Dispose()
  $keyed.Dispose()
  $src.Dispose()
}

function Process-Direct([string]$inFile, [string]$outFile, [int]$w, [int]$h) {
  $src = [System.Drawing.Bitmap]::new($inFile)
  $final = [SpriteProcessor]::ResizeExact($src, $w, $h)
  $final.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host ("  [OK] {0} -> {1}x{2}" -f (Split-Path $outFile -Leaf), $w, $h)
  $final.Dispose()
  $src.Dispose()
}

Process-Cutout (Join-Path $RawDir "2b-full.png") (Join-Path $OutDir "2b-full.png") 260 440 8 4
Process-Cutout (Join-Path $RawDir "pod-042.png") (Join-Path $OutDir "pod-042.png") 140 160 6 6
Process-Cutout (Join-Path $RawDir "katana.png")  (Join-Path $OutDir "katana.png")  260 90 6 6

Process-Direct (Join-Path $RawDir "cutin-slash.png")  (Join-Path $OutDir "cutin-slash.png")  420 236
Process-Direct (Join-Path $RawDir "cutin-eyes.png")   (Join-Path $OutDir "cutin-eyes.png")   420 236
Process-Direct (Join-Path $RawDir "portrait-2b.png")  (Join-Path $OutDir "portrait-2b.png")  160 160
Process-Direct (Join-Path $RawDir "portrait-pod.png") (Join-Path $OutDir "portrait-pod.png") 160 160
Process-Direct (Join-Path $RawDir "portrait-2b.png")  (Join-Path $OutDir "tray.png")         32 32

$p2b = [System.Drawing.Bitmap]::new((Join-Path $OutDir "portrait-2b.png"))
[SpriteProcessor]::WriteIco($p2b, (Join-Path $OutDir "yorha.ico"))
$p2b.Dispose()
Write-Host "  [OK] yorha.ico generated"
`;

function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  console.log('1. Copying raw generated assets into themes/nier-2b/assets/raw/...');
  for (const [dstName, srcName] of Object.entries(RAW_SOURCES)) {
    const srcPath = path.join(ARTIFACT_DIR, srcName);
    const dstPath = path.join(RAW_DIR, dstName);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, dstPath);
    } else if (!fs.existsSync(dstPath)) {
      throw new Error(`Missing raw image: ${srcPath}`);
    }
  }

  console.log('2. Running chroma-key removal and sprite normalization...');
  const tempPs = path.join(__dirname, '_run_assets.ps1');
  fs.writeFileSync(tempPs, PS_SCRIPT, 'utf8');
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', tempPs, RAW_DIR, ASSETS_DIR,
    ], { encoding: 'utf8' });
    process.stdout.write(out);
  } finally {
    try { fs.unlinkSync(tempPs); } catch {}
  }
}

if (require.main === module) {
  main();
}
