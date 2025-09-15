import argparse
import json
import os
import time
from pathlib import Path
from astroquery.simbad import Simbad
from tqdm import tqdm

# configure extra fields
Simbad.reset_votable_fields()
Simbad.add_votable_fields("ids")      # other cross-identifications
Simbad.add_votable_fields("main_id")  # canonical name

# safe defaults
BATCH_SIZE = 50
DELAY_S = 1.0   # seconds between batches
RETRIES = 3
RETRY_DELAY = 3.0

def load_cache(path: Path):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf8"))
        except Exception:
            return {}
    return {}

def save_cache(path: Path, cache):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf8")

def query_simbad_for_hips(hip_list):
    """
    Query Simbad for a list of 'HIP <id>' strings.
    Returns dict mapping 'HIP:<id>' -> {'main_id':..., 'ids':[...] }
    """
    # Simbad.query_objects accepts object names like "HIP 123"
    qnames = [f"HIP {int(h)}" for h in hip_list]
    for attempt in range(1, RETRIES+1):
        try:
            result = Simbad.query_objects(qnames)
            # result may be None or a table
            out = {}
            if result is None:
                return out
            for row in result:
                # Simbad returns MAIN_ID and IDS columns
                main = row.get("MAIN_ID")
                ids_raw = row.get("IDS")
                # Some rows may not have 'IDS'; normalize
                ids_list = []
                if ids_raw is not None:
                    # IDS often a string like 'HD 48915;HIP 32349;...'
                    ids_list = [s.strip() for s in str(ids_raw).split("|") if s.strip()] if "|" in str(ids_raw) else [s.strip() for s in str(ids_raw).split(";") if s.strip()]
                # find HIP id in ids_list or from qnames
                # normalize key to HIP:<n>
                hip_key = None
                # try to find HIP n in ids
                for token in ids_list:
                    tok = token.replace(" ", "")
                    if tok.upper().startswith("HIP"):
                        try:
                            hip_key = f"HIP:{int(tok[3:])}"
                            break
                        except:
                            pass
                # if not found, attempt to parse main string for HIP N
                if hip_key is None:
                    # try to match from original qnames: first token "HIP N"
                    # but astroquery result doesn't include original query; find best match by parsing ids again
                    hip_key = None
                out[hip_key or f"HIP:UNKNOWN"] = {
                    "main_id": str(main) if main is not None else None,
                    "ids": ids_list
                }
            return out
        except Exception as e:
            print(f"SIMBAD query attempt {attempt} failed: {e}")
            if attempt < RETRIES:
                time.sleep(RETRY_DELAY)
            else:
                raise
    return {}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="output/hipparcos.ndjson")
    parser.add_argument("--out", default="output/hipparcos.with_names.ndjson")
    parser.add_argument("--cache", default="output/names_cache.json")
    parser.add_argument("--sample", default="data/hipparcos_sample_named.ndjson")
    parser.add_argument("--sample-size", type=int, default=50)
    parser.add_argument("--delay", type=float, default=DELAY_S)
    parser.add_argument("--batch", type=int, default=BATCH_SIZE)
    args = parser.parse_args()

    input_path = Path(args.input)
    out_path = Path(args.out)
    cache_path = Path(args.cache)
    sample_path = Path(args.sample)

    if not input_path.exists():
        print("Input file not found:", input_path)
        return

    cache = load_cache(cache_path)
    print(f"Loaded cache entries: {len(cache)}")

    lines = [l for l in input_path.read_text(encoding="utf8").splitlines() if l.strip()]
    print("Total records:", len(lines))

    # gather HIP ids (expect 'hip' field per record)
    records = []
    hips = []
    for ln in lines:
        obj = json.loads(ln)
        records.append(obj)
        if "hip" in obj and obj["hip"] is not None:
            hips.append(int(obj["hip"]))

    unique_hips = sorted(set(hips))
    print("HIPs:", len(unique_hips))

    # build list of hips needing lookup
    need = [h for h in unique_hips if f"HIP:{h}" not in cache]
    print("HIPs to lookup (not cached):", len(need))
    if len(need) == 0:
        print("All HIPs cached. Augmenting records from cache...")
    else:
        # batch query SIMBAD
        for i in range(0, len(need), args.batch):
            batch = need[i:i+args.batch]
            print(f"Querying SIMBAD for hips {batch[0]}..{batch[-1]} (count {len(batch)})")
            # Simbad expects 'HIP X' style names
            qnames = [f"HIP {h}" for h in batch]
            # perform query
            try:
                tbl = Simbad.query_objects(qnames)
            except Exception as e:
                print("Error querying SIMBAD:", e)
                tbl = None

            # If result is None, no matches for batch
            if tbl is None:
                # mark cache entries as None so we don't requery immediately
                for h in batch:
                    cache[f"HIP:{h}"] = {"main_id": None, "ids": []}
            else:
                # iterate rows: astroph query result has MAIN_ID and IDS
                # NOTE: Simbad returns results in the same order for found objects; not necessarily all requested
                for row in tbl:
                    main = row.get("MAIN_ID")
                    ids_raw = row.get("IDS")
                    ids_list = []
                    if ids_raw is not None:
                        s = str(ids_raw)
                        if "|" in s:
                            ids_list = [t.strip() for t in s.split("|") if t.strip()]
                        else:
                            ids_list = [t.strip() for t in s.split(";") if t.strip()]
                    # attempt to find HIP id in ids_list
                    hip_key = None
                    for token in ids_list:
                        tok = token.replace(" ", "")
                        if tok.upper().startswith("HIP"):
                            try:
                                hipnum = int(tok[3:])
                                hip_key = f"HIP:{hipnum}"
                                break
                            except:
                                pass
                    # fallback: if no hip_key, try to find digits from MAIN_ID
                    if hip_key is None:
                        # try to parse digits at end
                        hip_key = None

                    # store in cache; if hip_key unresolved, put under MAIN_ID pseudo-key
                    if hip_key is None:
                        # try to attach for each requested hip that includes the same coordinate? fallback: assign to first requested
                        # For robustness, assign to first requested HIP in batch (best-effort)
                        hip_key = f"HIP:{batch[0]}"

                    cache[hip_key] = {"main_id": str(main) if main is not None else None, "ids": ids_list}

            # polite delay
            time.sleep(args.delay)

        # after querying all batches, save cache
        save_cache(cache_path, cache)
        print("Finished lookups. Cached:", len(cache))

    # Now enrich original records using cache (lookup by HIP:<n>)
    out_lines = []
    for rec in records:
        hip = rec.get("hip")
        name = None
        if hip is not None:
            key = f"HIP:{int(hip)}"
            c = cache.get(key)
            if c:
                # prefer main_id, else pick first IDS that isn't HIP
                if c.get("main_id"):
                    name = c.get("main_id")
                else:
                    ids = c.get("ids", [])
                    # select non-HIP id if present
                    alt = next((x for x in ids if not x.strip().upper().startswith("HIP")), None)
                    name = alt or None
        rec["name"] = name
        out_lines.append(json.dumps(rec, ensure_ascii=False))

    # write outputs
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(out_lines) + "\n", encoding="utf8")
    print("Saved NDJSON:", out_path)

    # create small sample for dev
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    sample_size = min(args.sample_size, len(out_lines))
    sample_lines = out_lines[:sample_size]
    sample_path.write_text("\n".join(sample_lines) + "\n", encoding="utf8")
    print("Saved sample:", sample_path)

if __name__ == "__main__":
    main()