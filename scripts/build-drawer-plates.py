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

1. HEADERS are cropped to their last fully opaque row, then their bottom 30% is cross-faded
   to the rail. The generator ends them with a ragged torn-paper alpha fade, and the day plate
   came back flattened onto its own checkerboard, so its fade region is contaminated grey;
   cropping discards both. But a bare crop was wrong on the phone in two ways at once -- the
   vine borders stopped dead on a horizontal line, and the paper's own vignette made its edges
   land off the average the rail was sampled from, so the join showed as a faint colour step.
   Fading the band to the rail fixes both from one cause: the vines dissolve well above the
   join instead of being chopped, and the last row IS the rail by construction, so there is
   no step left to see. 30% puts the dissolve just under STORYMAP; 14% and 22% both still
   left a visible vine stub at the title line.

2. CITIES have the dead RGB under their alpha ramp replaced, then are flattened onto the rail.
   The generator leaves fully transparent pixels black; LANCZOS does not know they are
   invisible and drags that black up into the visible part of the ramp as a dirty edge. The
   flattening is what §32.2 already learned on the night pair -- see RAIL below.

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

# The rail each mode's panel is painted with -- sampled from that mode's own header by
# build_header() below, and the value theme.ts carries. The cities are FLATTENED onto it
# rather than shipped with alpha: the ramp only ever composites over this one flat colour,
# so the result is identical on screen, no half-transparent pixel can land lighter than the
# panel the way §32.2 found, and an opaque WEBP compresses far better than one carrying an
# alpha channel.
RAIL = {'day': (0xef, 0xdd, 0xb2), 'night': (0xef, 0xdc, 0xb5)}

# Measured, not chosen: the last row of both header plates where the parchment is still
# fully opaque and clean. Both plates are 1586x992 and share the crop, so day and night have
# identical geometry and the title band lands in the same place in each.
HEADER_CROP = 780
HEADER_W = 1080
CITY_SIZE = (1080, 720)          # 3:2, the slot the drawer gives it
HEADER_FADE = 0.30               # bottom fraction cross-faded to RAIL
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

    bw, bh = im.size

    # Cross-fade the foot to the rail so the vines dissolve and the join cannot show a step.
    px = im.load()
    r0, g0, b0 = RAIL[mode]
    rows = int(bh * HEADER_FADE)
    start = bh - rows
    for y in range(start, bh):
        # rows - 1, not rows: the divisor has to make the LAST row land on exactly 1.0, or
        # the plate's own pixels still contribute a unit or two there and the join keeps a
        # faint step. Re-encoding at higher quality does not help -- the spread is in the
        # ramp, not the codec.
        s = smootherstep((y - start) / (rows - 1))
        for x in range(bw):
            r, g, b = px[x, y]
            px[x, y] = (int(r + (r0 - r) * s), int(g + (g0 - g) * s), int(b + (b0 - b) * s))

    path = f'{OUT}/drawer-{mode}-header.webp'
    im.save(path, 'WEBP', quality=92, method=6)

    # The rail theme.ts must carry, read back off the ENCODED file's last row rather than
    # off the image in memory. The fade makes that row uniform, but WEBP still moves it a
    # unit or two, and the value that matters is the one the device draws -- a panel painted
    # with what was intended rather than with what shipped is a seam again, just a smaller one.
    done = Image.open(path).convert('RGB')
    row = [done.getpixel((x, done.size[1] - 1)) for x in range(done.size[0])]
    rail = tuple(sum(c[i] for c in row) // len(row) for i in range(3))
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
    flat = Image.new('RGB', CITY_SIZE, RAIL[mode])
    flat.paste(im, (0, 0), im)
    path = f'{OUT}/drawer-{mode}-city.webp'
    flat.save(path, 'WEBP', quality=92, method=6)
    print(f'{path}  {CITY_SIZE}  {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    build_header('day', 'dayplate_top.png')
    build_header('night', 'nightplate_top.png')
    build_city('day', 'dayplate_bottom.png')
    build_city('night', 'nightplate_bottom.png', ramp=NIGHT_RAMP)
