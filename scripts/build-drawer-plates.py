#!/usr/bin/env python3
"""Turn the four supplied drawer plates into the four files the app ships.

    python scripts/build-drawer-plates.py

Reads  assets/{day,night}plate_{top,bottom}.png   (the generator's output, kept as source)
Writes mobile/assets/drawer-{day,night}-{header,city}.webp

Nothing here is a taste decision that could equally have gone another way -- every number
is measured off the artwork, which is the whole point (handoff §32: the drawer IS the plate,
and a value the code picks independently shows up as a seam). Re-run it if new plates arrive;
it also prints the rail colours theme.ts must carry.

Three transforms, each fixing something the generator does that the app cannot use:

1. HEADERS are cropped to their last fully opaque row. The generator ends them with a ragged
   torn-paper alpha fade, and the day plate came back flattened onto its own checkerboard, so
   its fade region is contaminated grey. Cropping discards both problems and leaves a flat
   parchment bottom edge -- which is then sampled for the panel colour, so the picture stops
   and the rail starts with nothing drawn over the join.

2. CITIES keep their alpha ramp but have the dead RGB under it replaced. The generator leaves
   fully transparent pixels black; LANCZOS does not know they are invisible and drags that
   black up into the visible part of the ramp as a dirty edge.

3. The NIGHT city's ramp is rebuilt long and eased. It is a dark scene dissolving into cream
   paper, so partial alpha composites to grey no matter what -- a short ramp shows that as a
   distinct band of haze laid across the picture. Spread over 45% of the height with a
   smootherstep, the same grey reads as atmosphere above the clouds. The day city needs none
   of this: its sky is already pale, and the generator gave it a long ramp of its own.
"""

import os
from PIL import Image

SRC = 'assets'
OUT = 'mobile/assets'

# Measured, not chosen: the last row of both header plates where the parchment is still
# fully opaque and clean. Both plates are 1586x992 and share the crop, so day and night have
# identical geometry and the title band lands in the same place in each.
HEADER_CROP = 780
HEADER_W = 1080
CITY_SIZE = (1080, 720)          # 3:2, the slot the drawer gives it
NIGHT_RAMP = 0.45


def smootherstep(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def first_opaque_row(im, thresh=8):
    w, h = im.size
    px = im.load()
    for y in range(h):
        if max(px[x, y][3] for x in range(0, w, 8)) >= thresh:
            return y
    return 0


def build_header(mode, src):
    im = Image.open(f'{SRC}/{src}').convert('RGB')
    w, _ = im.size
    im = im.crop((0, 0, w, HEADER_CROP))
    im = im.resize((HEADER_W, round(HEADER_W * HEADER_CROP / w)), Image.LANCZOS)
    path = f'{OUT}/drawer-{mode}-header.webp'
    im.save(path, 'WEBP', quality=92, method=6)

    # The panel colour theme.ts must use, taken from the plate's own bottom edge with the
    # vine borders excluded. The panel matches the paper; the paper does not match the panel.
    bw, bh = im.size
    band = list(im.crop((int(bw * 0.25), bh - 6, int(bw * 0.75), bh)).getdata())
    rail = tuple(sum(c[i] for c in band) // len(band) for i in range(3))
    print(f'{path}  {im.size}  ratio {bw / bh:.4f}  '
          f'{os.path.getsize(path) // 1024} KB  rail #%02x%02x%02x' % rail)


def build_city(mode, src, ramp=None):
    im = Image.open(f'{SRC}/{src}').convert('RGBA')
    first = first_opaque_row(im)

    if ramp:
        # Drop the dead rows entirely and re-ramp what is left.
        w, h = im.size
        im = im.crop((0, first, w, h))
        w, h = im.size
        alpha = im.getchannel('A')          # a COPY -- it has to be put back
        ap = alpha.load()
        rows = int(h * ramp)
        for y in range(rows):
            s = smootherstep(y / rows)
            for x in range(w):
                ap[x, y] = int(ap[x, y] * s)
        im.putalpha(alpha)
    else:
        # Keep the generator's own ramp, but flood the invisible rows above it with the
        # colour of the first visible one so the resample has nothing dark to smear.
        w, _ = im.size
        px = im.load()
        for y in range(first):
            for x in range(w):
                sr, sg, sb, _unused = px[x, first]
                px[x, y] = (sr, sg, sb, px[x, y][3])

    im = im.resize(CITY_SIZE, Image.LANCZOS)
    path = f'{OUT}/drawer-{mode}-city.webp'
    im.save(path, 'WEBP', quality=92, method=6)
    print(f'{path}  {CITY_SIZE}  {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    build_header('day', 'dayplate_top.png')
    build_header('night', 'nightplate_top.png')
    build_city('day', 'dayplate_bottom.png')
    build_city('night', 'nightplate_bottom.png', ramp=NIGHT_RAMP)
