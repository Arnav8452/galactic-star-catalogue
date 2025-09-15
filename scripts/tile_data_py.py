import os, json, gzip, math
from collections import defaultdict

INFILE = "output/hipparcos.ndjson"
OUTDIR = "data/tiles"
TILE_DEG = 4.0

os.makedirs(OUTDIR, exist_ok=True)

# read lines
with open(INFILE, "r", encoding="utf8") as fh:
    lines = [ln.strip() for ln in fh if ln.strip()]

print(f"Read {len(lines)} stars from {INFILE}")

tiles = defaultdict(list)
for ln in lines:
    try:
        obj = json.loads(ln)
    except Exception:
        continue
    ra = obj.get("ra")
    dec = obj.get("dec")
    if ra is None or dec is None:
        continue
    try:
        ra = float(ra); dec = float(dec)
    except Exception:
        continue
    tx = int(math.floor(((ra % 360) + 360) % 360 / TILE_DEG))
    ty = int(math.floor((dec + 90.0) / TILE_DEG))
    key = f"{tx}_{ty}"
    tiles[key].append(obj)

print(f"Preparing to write {len(tiles)} tiles to {OUTDIR} ...")
written = 0
for key, arr in tiles.items():
    plain = "\n".join(json.dumps(x, default=str) for x in arr) + "\n"
    path_plain = os.path.join(OUTDIR, f"{key}.ndjson")
    with open(path_plain, "w", encoding="utf8") as fh:
        fh.write(plain)
    # gzip
    path_gz = path_plain + ".gz"
    with gzip.open(path_gz, "wb") as gzfh:
        gzfh.write(plain.encode("utf8"))
    written += 1

print(f"Wrote {written} tiles to {OUTDIR}")