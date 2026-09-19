#!/usr/bin/env python3
"""Build the app icon set from the drawer plate's own compass rose.

    python scripts/build-app-icon.py

Reads  assets/dayplate_top.png                     (the drawer header, source of the rose)
Writes mobile/assets/icon.png                       1024, legacy / iOS, parchment full-bleed
       mobile/assets/android-icon-foreground.png    512, adaptive foreground, transparent
       mobile/assets/android-icon-background.png    512, adaptive background, parchment
       mobile/assets/android-icon-monochrome.png    432, themed-icon silhouette
       mobile/assets/favicon.png                    64

The icon is not new art: it is the rose the drawer already wears, lifted off its plate, on the
drawer's own parchment (`RAIL` in build-drawer-plates.py). Two things about the lift:

- The rose is taken as the connected component of ink around the plate's centre, not as a
  box, because the bead arc passes inside any box that holds the E-W points. The sunburst
  touches the north point, so it comes along and is cut at the neck (row 182); the north
  point is then rebuilt by mirroring the south half, which the rose's own symmetry allows.
- The source rose is ~380px. That is enough: every launcher size (48-192px) is a downsample
  of it, and only the 1024 master and a Play Store 512 would show the upscale.

Icons are compiled into the binary, so this needs `eas build`, not `eas update`.
"""

from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'assets/dayplate_top.png'
OUT = 'mobile/assets'
PAPER = (0xEF, 0xDD, 0xB1)   # the drawer rail
EDGE = (0xE6, 0xD2, 0xA4)    # the plate's paper at mid-height (theme.ts `chrome` by day)
NECK_ROW = 182               # below the sunburst, measured
SAFE = 0.56                  # of the adaptive foreground; the launcher shows the central 66%


def lift_rose():
    im = Image.open(SRC).convert('RGB')
    a = np.asarray(im).astype(float)
    lum = a.mean(axis=2)
    ink = lum < 170
    # dilate slightly so hairlines connect
    grown = np.asarray(Image.fromarray((ink * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
    h, w = ink.shape
    cx, cy = w // 2, int(h * 0.32)
    start = next(((cx + dx, cy + dy) for r in range(40) for dy in range(-r, r + 1) for dx in range(-r, r + 1)
                  if ink[cy + dy, cx + dx]), None)
    seen = np.zeros_like(ink, bool)
    q = deque([start])
    seen[start[1], start[0]] = True
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny, nx] and grown[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))
    seen[:NECK_ROW, :] = False
    ys, xs = np.where(seen)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()

    alpha = np.clip((232.0 - lum) / (232.0 - 60.0), 0, 1)
    region = np.asarray(Image.fromarray((seen * 255).astype('uint8')).filter(ImageFilter.MaxFilter(7))) > 0
    alpha = alpha * region
    rgba = np.dstack([a, alpha * 255]).astype('uint8')
    rose = np.asarray(Image.fromarray(rgba, 'RGBA').crop((x0 - 4, y0 - 4, x1 + 5, y1 + 5)))

    # Rebuild the clipped north point from the south half.
    al = rose[:, :, 3]
    cy = int((al > 40).sum(axis=1).argmax())
    cx = int((al > 40).sum(axis=0).argmax())
    bottom = rose[cy:]
    full = np.concatenate([bottom[::-1][:-1], bottom], axis=0)
    hh, ww = full.shape[:2]
    half = max(cx, ww - 1 - cx)
    canvas = np.zeros((hh, 2 * half + 1, 4), 'uint8')
    canvas[:, half - cx:half - cx + ww] = full
    return Image.fromarray(canvas, 'RGBA')


def parchment(size):
    y, x = np.mgrid[0:size, 0:size].astype(float)
    c = (size - 1) / 2
    t = np.clip(np.sqrt((x - c) ** 2 + (y - c) ** 2) / (c * 1.25), 0, 1) ** 2
    arr = np.zeros((size, size, 3))
    for i in range(3):
        arr[:, :, i] = PAPER[i] + (EDGE[i] - PAPER[i]) * t
    return Image.fromarray(arr.astype('uint8'), 'RGB')


def fit(img, box):
    w, h = img.size
    s = box / max(w, h)
    return img.resize((round(w * s), round(h * s)), Image.LANCZOS)


def centre(bg, fg):
    bg = bg.copy()
    bg.paste(fg, ((bg.width - fg.width) // 2, (bg.height - fg.height) // 2), fg)
    return bg


if __name__ == '__main__':
    rose = lift_rose()
    print('rose', rose.size)

    centre(parchment(1024), fit(rose, int(1024 * 0.74))).save(f'{OUT}/icon.png')
    centre(Image.new('RGBA', (512, 512), (0, 0, 0, 0)), fit(rose, int(512 * SAFE))).save(
        f'{OUT}/android-icon-foreground.png')
    parchment(512).convert('RGBA').save(f'{OUT}/android-icon-background.png')
    r = fit(rose, int(432 * SAFE))
    white = Image.new('RGBA', r.size, (255, 255, 255, 255))
    white.putalpha(r.getchannel('A'))
    centre(Image.new('RGBA', (432, 432), (0, 0, 0, 0)), white).save(f'{OUT}/android-icon-monochrome.png')
    centre(parchment(64), fit(rose, 50)).save(f'{OUT}/favicon.png')
    print('icon set written to', OUT)
