import os
import json
import random
from math import log10
from pathlib import Path

import numpy as np

# Config
NUM_NEW = 10_000
START_AFTER_HIP = 50
SEED = 42
INPUT1 = Path("output/hipparcos.ndjson")
INPUT_FALLBACK = Path("data/hipparcos_sample.ndjson")
OUT_NEW = Path("data/hipparcos_10k_after_hip50.ndjson")
OUT_AUG = Path("output/hipparcos_augmented.ndjson")

np.random.seed(SEED)
random.seed(SEED)


def load_ndjson(path: Path):
    if not path.exists():
        return []
    out = []
    with path.open("r", encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if not ln:
                continue
            try:
                out.append(json.loads(ln))
            except Exception as e:
                print(f"warning: skipping bad json line: {e}")
    return out


def ballesteros_temp_from_bv(bv):
    # Ballesteros approximation (safe handling)
    try:
        bv = float(bv)
    except Exception:
        return None
    if np.isnan(bv):
        return None
    try:
        T = 4600.0 * (1.0 / (0.92 * bv + 1.7) + 1.0 / (0.92 * bv + 0.62))
        return float(T)
    except Exception:
        return None


def make_new_star_from_template(template: dict, new_hip: int):
    # Template fields expected: ra, dec, dist_pc, vmag, plx, bv, sp_type
    # We'll perturb values to produce a distinct but realistic-looking star.
    # RA: uniform 0..360, Dec: -90..90, Dist: log-normal-ish, Vmag perturb, B-V perturb
    # If template has missing values, we synthesize plausible ones.
    tem_ra = template.get("ra")
    tem_dec = template.get("dec")
    tem_dist = template.get("dist_pc")
    tem_vmag = template.get("vmag")
    tem_plx = template.get("plx")
    tem_bv = template.get("bv")

    # RA/Dec: either near template or random
    if tem_ra is None:
        ra = float(np.random.uniform(0.0, 360.0))
    else:
        ra = float((tem_ra + np.random.normal(0, 5.0)) % 360.0)

    if tem_dec is None:
        dec = float(np.random.uniform(-80.0, 80.0))
    else:
        dec = float(max(-90.0, min(90.0, tem_dec + np.random.normal(0, 3.0))))

    # Distance: if known, perturb multiplicatively; else sample from a skewed distribution
    if tem_dist and tem_dist > 0:
        # log-normal perturbation
        factor = float(10 ** np.random.normal(0, 0.25))
        dist_pc = float(max(1.0, tem_dist * factor))
    else:
        # sample between 1 and 5000 (skew to nearer stars)
        dist_pc = float(10 ** np.random.uniform(0, 3.7))  # 1..~5000

    # Parallax (mas). plx = 1000 / dist_pc
    plx = float(1000.0 / dist_pc) if dist_pc > 0 else None

    # Apparent magnitude: perturb template or sample
    if tem_vmag is not None:
        vmag = float(max(-2.0, tem_vmag + np.random.normal(0, 0.7)))
    else:
        # sample between 0 and 12, skewed toward fainter
        vmag = float(np.random.normal(8.0, 2.5))
        vmag = float(max(-2.0, min(18.0, vmag)))

    # B-V color: perturb or sample
    if tem_bv is not None:
        bv = float(tem_bv + np.random.normal(0, 0.15))
    else:
        bv = float(np.random.normal(0.65, 0.5))
    # clamp plausible range
    if bv is None or np.isnan(bv):
        bv = None
    else:
        bv = float(max(-0.5, min(2.0, bv)))

    # Absolute magnitude M = m - 5*(log10(d) - 1) if dist known
    absmag = None
    try:
        if dist_pc and dist_pc > 0 and vmag is not None:
            absmag = float(vmag - 5.0 * (log10(dist_pc) - 1.0))
    except Exception:
        absmag = None

    # Temperature from B-V
    temp_k = ballesteros_temp_from_bv(bv)

    # Build record
    rec = {
        "hip": int(new_hip),
        "ra": float(ra),
        "dec": float(dec),
        "dist_pc": float(dist_pc) if dist_pc is not None else None,
        "vmag": float(vmag) if vmag is not None else None,
        "plx": float(plx) if plx is not None else None,
        "bv": float(bv) if bv is not None else None,
        "sp_type": None,
        "absmag": float(absmag) if absmag is not None else None,
        "temp_k": float(temp_k) if temp_k is not None else None,
    }
    return rec


def main():
    # load input
    if INPUT1.exists():
        src_path = INPUT1
    elif INPUT_FALLBACK.exists():
        src_path = INPUT_FALLBACK
    else:
        print("ERROR: No input NDJSON found. Place your hipparcos.ndjson in 'output/' or sample in 'data/'.")
        return

    print(f"Loading input NDJSON from: {src_path}")
    base = load_ndjson(src_path)
    existing_by_hip = {}
    existing_hips = set()
    for r in base:
        hip = r.get("hip")
        if hip is None:
            continue
        existing_by_hip[int(hip)] = r
        existing_hips.add(int(hip))

    print(f"Loaded {len(base)} source stars (unique HIPs: {len(existing_hips)})")

    # Determine starting HIP candidate
    new_records = []
    next_hip = START_AFTER_HIP + 1  # start trying from 51
    created = 0
    max_iterations = NUM_NEW * 5  # guard
    iter_count = 0
    hips_tried = set()

    # pool for templates
    templates = list(existing_by_hip.values())
    if not templates:
        print("ERROR: no template stars available to synthesize from.")
        return

    # If there are existing HIP > START_AFTER_HIP, skip them when picking new hip numbers.
    # We'll iterate hip numbers upward until we have NUM_NEW new entries (avoiding collisions).
    curr_candidate = START_AFTER_HIP + 1
    while created < NUM_NEW and iter_count < max_iterations:
        iter_count += 1
        hip_candidate = curr_candidate
        curr_candidate += 1
        if hip_candidate in existing_hips:
            continue  # skip collision

        # create new star
        tpl = random.choice(templates)
        new_rec = make_new_star_from_template(tpl, hip_candidate)
        new_records.append(new_rec)
        existing_hips.add(hip_candidate)
        created += 1

    print(f"Created {created} new synthetic stars (attempts: {iter_count})")

    # write new-only file
    OUT_NEW.parent.mkdir(parents=True, exist_ok=True)
    with OUT_NEW.open("w", encoding="utf-8") as f:
        for r in new_records:
            f.write(json.dumps(r) + "\n")
    print(f"Wrote {len(new_records)} new records to {OUT_NEW}")

    # write augmented file (original + appended)
    OUT_AUG.parent.mkdir(parents=True, exist_ok=True)
    with OUT_AUG.open("w", encoding="utf-8") as f:
        # write originals (from input source)
        for r in base:
            f.write(json.dumps(r) + "\n")
        # write new
        for r in new_records:
            f.write(json.dumps(r) + "\n")
    print(f"Wrote augmented catalogue (original + new) to {OUT_AUG}")

    print("Done. If you want to tile these, run your tiling script on the augmented file.")
    print(f"Example: node scripts/tile_data.mjs {OUT_AUG}")


if __name__ == "__main__":
    main()