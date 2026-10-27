"""Prepares visual assets for themes/nier-2b/assets/ from the generated raw images.

Performs HSV + green-excess chroma-key background removal with edge despill and alpha feathering
on 2b-full.png, pod-042.png, and katana.png, normalizes sprite dimensions for the WebGL 2D shader
rig, and generates tray.png, app-icon.png, and yorha.ico for the silent launcher.
"""

import shutil
import os
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "themes" / "nier-2b" / "assets"
RAW_DIR = ASSETS_DIR / "raw"
ARTIFACT_DIR = Path(os.environ.get("ARTIFACT_DIR", RAW_DIR))

RAW_SOURCES = {
    "2b-full.jpg": "2b_full_1792969083594.jpg",
    "pod-042.jpg": "pod_042_anime_accurate_1792974981439.jpg",
    "katana.jpg": "virtuous_treaty_sprite_1792979450619.jpg",
    "cutin-slash.jpg": "cutin_slash_1792969136803.jpg",
    "cutin-eyes.jpg": "cutin_eyes_1792969158885.jpg",
    "portrait-2b.jpg": "portrait_2b_1792969178796.jpg",
    "portrait-pod.jpg": "pod_042_anime_accurate_1792974981439.jpg",
    "app-icon.jpg": "app-icon.jpg",
}


def remove_green_chroma(img: Image.Image, threshold: float = 42.0, ramp: float = 55.0) -> Image.Image:
    """Removes bright green (#00FF00) background with green despill on edges."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            max_rb = max(r, b)
            excess = g - max_rb
            if excess > threshold and g > 90:
                if excess >= threshold + ramp:
                    px[x, y] = (0, 0, 0, 0)
                else:
                    alpha = int(255 * (1.0 - (excess - threshold) / ramp))
                    # Despill green fringe
                    new_g = min(g, int(max_rb + 8))
                    px[x, y] = (r, new_g, b, alpha)
            elif excess > 12 and g > 100:
                # Subtle despill on anti-aliased dark outline pixels
                new_g = int(g - (excess - 12) * 0.75)
                px[x, y] = (r, new_g, b, a)

    return rgba


def bbox_alpha(img: Image.Image, min_alpha: int = 32):
    w, h = img.size
    px = img.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] >= min_alpha:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < min_x:
        return (0, 0, w, h)
    return (min_x, min_y, max_x + 1, max_y + 1)


def build_2b_sprite(src_path: Path, out_path: Path):
    """Builds 260x440 2b-full.png with centered symmetrical character cut-out."""
    img = Image.open(src_path)
    cut = remove_green_chroma(img, threshold=34.0, ramp=48.0)
    box = bbox_alpha(cut, min_alpha=40)
    cropped = cut.crop(box)

    target_w, target_h = 260, 440
    # Fit height to 424px (top=10, feet=434)
    char_h = 424
    scale = char_h / cropped.height
    char_w = int(round(cropped.width * scale))
    resized = cropped.resize((char_w, char_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    paste_x = (target_w - char_w) // 2
    paste_y = 10
    canvas.paste(resized, (paste_x, paste_y), resized)
    canvas.save(out_path, optimize=True)
    print(f"  [OK] {out_path.name}: {canvas.size} (char bbox {char_w}x{char_h} at x={paste_x}, y={paste_y})")


def build_trimmed_sprite(src_path: Path, out_path: Path, max_dim: int, pad: int = 8):
    img = Image.open(src_path)
    cut = remove_green_chroma(img, threshold=34.0, ramp=48.0)
    box = bbox_alpha(cut, min_alpha=40)
    cropped = cut.crop(box)

    scale = min((max_dim - pad * 2) / cropped.width, (max_dim - pad * 2) / cropped.height)
    nw = max(1, int(round(cropped.width * scale)))
    nh = max(1, int(round(cropped.height * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (nw + pad * 2, nh + pad * 2), (0, 0, 0, 0))
    canvas.paste(resized, (pad, pad), resized)
    canvas.save(out_path, optimize=True)
    print(f"  [OK] {out_path.name}: {canvas.size}")


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    print("1. Copying generated raw assets...")
    for dst_name, src_name in RAW_SOURCES.items():
        src_file = ARTIFACT_DIR / src_name
        dst_file = RAW_DIR / dst_name
        if src_file.exists() and src_file.resolve() != dst_file.resolve():
            shutil.copy2(src_file, dst_file)

    print("2. Chroma-keying and building sprites...")
    if (RAW_DIR / "2b-full.jpg").exists():
        build_2b_sprite(RAW_DIR / "2b-full.jpg", ASSETS_DIR / "2b-full.png")
    if (RAW_DIR / "pod-042.jpg").exists():
        build_trimmed_sprite(RAW_DIR / "pod-042.jpg", ASSETS_DIR / "pod-042.png", max_dim=180, pad=8)
    if (RAW_DIR / "katana.jpg").exists():
        build_trimmed_sprite(RAW_DIR / "katana.jpg", ASSETS_DIR / "katana.png", max_dim=280, pad=8)

    print("3. Formatting cut-ins, portraits, and icons...")
    for name, size in [
        ("cutin-slash", (420, 236)),
        ("cutin-eyes", (420, 236)),
        ("portrait-2b", (160, 160)),
        ("portrait-pod", (160, 160)),
    ]:
        raw_file = RAW_DIR / f"{name}.jpg"
        if raw_file.exists():
            im = Image.open(raw_file).convert("RGBA")
            im = im.resize(size, Image.Resampling.LANCZOS)
            out = ASSETS_DIR / f"{name}.png"
            im.save(out, optimize=True)
            print(f"  [OK] {out.name}: {im.size}")

    # Application icon, tray icon and Windows .ico from app-icon.jpg (or fallback portrait-2b)
    icon_src = RAW_DIR / "app-icon.jpg"
    if not icon_src.exists():
        icon_src = ASSETS_DIR / "portrait-2b.png"

    if icon_src.exists():
        icon_img = Image.open(icon_src).convert("RGBA")
        tray = icon_img.resize((32, 32), Image.Resampling.LANCZOS)
        tray.save(ASSETS_DIR / "tray.png", optimize=True)
        app_icon = icon_img.resize((512, 512), Image.Resampling.LANCZOS)
        app_icon.save(ASSETS_DIR / "app-icon.png", optimize=True)
        icon_img.save(ASSETS_DIR / "yorha.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        print(f"  [OK] tray.png, app-icon.png & yorha.ico generated from {icon_src.name}.")


if __name__ == "__main__":
    main()
