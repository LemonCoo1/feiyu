#!/usr/bin/env python3
"""Generate all Feiyu desktop icon formats from logo.svg."""
import io
import os
import shutil
import subprocess
import sys
from pathlib import Path

import cairosvg
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SVG = REPO / "apps/desktop/public/logo.svg"
ICONS = REPO / "apps/desktop/src-tauri/icons"

if not SVG.exists():
    sys.exit(f"missing {SVG}")

svg_bytes = SVG.read_bytes().decode("utf-8")
ICONS.mkdir(parents=True, exist_ok=True)


def render(size: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg_bytes.encode("utf-8"),
                           output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


# Base high-res render
base = render(1024)

# PNG sizes Tauri expects
for name, size in [("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256)]:
    img = base.resize((size, size), Image.LANCZOS)
    img.save(ICONS / name)
    print(f"wrote {name} ({size}x{size})")

# Multi-size ICO for Windows
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_imgs = [base.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_imgs[0].save(ICONS / "icon.ico", format="ICO", sizes=ico_sizes)
print("wrote icon.ico")

# ICNS via iconutil
iconset = ICONS / "icon.iconset"
if iconset.exists():
    shutil.rmtree(iconset)
iconset.mkdir()
icns_spec = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]
for name, size in icns_spec:
    base.resize((size, size), Image.LANCZOS).save(iconset / name)
subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(ICONS / "icon.icns")], check=True)
shutil.rmtree(iconset)
print("wrote icon.icns")
print("done")
