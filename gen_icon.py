import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pillow', '-q'])
    from PIL import Image

from PIL import ImageDraw
import math

def draw_icon(size):
    s = size
    cx, cy = s // 2, s // 2
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded background
    r = max(4, s * 12 // 64)
    draw.rounded_rectangle([0, 0, s-1, s-1], radius=r, fill=(26, 26, 26, 255))

    amber_dark = (217, 119, 6, 230)
    amber      = (245, 158, 11, 255)

    ring_r = int(s * 0.34)
    ring_w = max(2, int(s * 0.04))

    # Nearly complete arc
    draw.arc([cx-ring_r, cy-ring_r, cx+ring_r, cy+ring_r],
             start=20, end=340, fill=amber_dark, width=ring_w)

    # Arrowhead at ~20 deg
    a = 20 * math.pi / 180
    ax = cx + ring_r * math.cos(a)
    ay = cy + ring_r * math.sin(a)
    arr = ring_r * 0.22
    pts = [
        (ax + arr * math.cos(a - 0.6), ay + arr * math.sin(a - 0.6)),
        (ax + arr * math.cos(a + 0.6), ay + arr * math.sin(a + 0.6)),
        (ax - arr * math.cos(a),       ay - arr * math.sin(a)),
    ]
    draw.polygon([(int(x), int(y)) for x,y in pts], fill=amber_dark)

    # Hour hand (up)
    hw = max(1, int(s * 0.035))
    draw.line([cx, cy, cx, cy - int(ring_r * 0.65)], fill=amber, width=hw)
    # Minute hand (toward ~210 deg = 7 o'clock)
    ma = (210 - 90) * math.pi / 180
    draw.line([cx, cy,
               cx + int(ring_r * 0.52 * math.cos(ma)),
               cy + int(ring_r * 0.52 * math.sin(ma))],
              fill=amber, width=hw)

    # Center dot
    dr = max(2, int(s * 0.032))
    draw.ellipse([cx-dr, cy-dr, cx+dr, cy+dr], fill=amber)

    return img

sizes = [16, 32, 48, 64, 128, 256]
images = {s: draw_icon(s) for s in sizes}

# Save .ico with all sizes properly
out = Path('D:/Development/Apps/cc-history/icon.ico')
images[256].save(
    out, format='ICO',
    append_images=[images[s] for s in [128, 64, 48, 32, 16]]
)
print(f'icon.ico: {out.stat().st_size:,} bytes')

# Save PNG preview
png = Path('D:/Development/Apps/cc-history/icon_preview.png')
images[256].save(png, format='PNG')
print(f'icon_preview.png: {png.stat().st_size:,} bytes')

# Favicon
fav = Path('D:/Development/Apps/cc-history/frontend/public/favicon.ico')
images[256].save(
    fav, format='ICO',
    append_images=[images[s] for s in [128, 64, 48, 32, 16]]
)
print(f'favicon.ico: {fav.stat().st_size:,} bytes')
