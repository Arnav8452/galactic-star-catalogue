# scripts/fetch_hipparcos_vizier.py
# Requires: pip install astroquery pandas tqdm numpy
import os, json, sys
from astroquery.vizier import Vizier
import pandas as pd
import numpy as np
from tqdm import tqdm

OUTPUT_DIR = "output"
NDJSON_OUT = os.path.join(OUTPUT_DIR, "hipparcos.ndjson")
CSV_OUT = os.path.join(OUTPUT_DIR, "hipparcos.csv")
SAMPLE_OUT = os.path.join("data", "hipparcos_sample.ndjson")
SAMPLE_SIZE = 5000

def fetch_vizier():
    Vizier.ROW_LIMIT = -1
    cols = ['HIP','RAICRS','DEICRS','Plx','Vmag','BTmag','VTmag','B-V','SpType']
    v = Vizier()
    print("Fetching Hipparcos main catalogue from VizieR...")
    try:
        if hasattr(v, 'get_catalogs'):
            tbls = v.get_catalogs('I/239/hip_main')
            if hasattr(tbls, 'keys'):
                first_key = list(tbls.keys())[0]
                table = tbls[first_key]
            else:
                table = tbls[0] if isinstance(tbls, (list, tuple)) else tbls
        else:
            tbls = v.query_constraints(catalog='I/239/hip_main')
            table = tbls[0] if isinstance(tbls, (list, tuple)) else tbls
    except Exception as e:
        print("Error querying VizieR:", e)
        sys.exit(1)

    df = table.to_pandas()
    return df

def normalize_and_compute(df):
    # RA/DEC robust selection
    if 'RAICRS' in df.columns and 'DEICRS' in df.columns:
        df['ra'] = pd.to_numeric(df['RAICRS'], errors='coerce')
        df['dec'] = pd.to_numeric(df['DEICRS'], errors='coerce')
    else:
        ra_cols = [c for c in df.columns if c.upper().startswith('RA')]
        de_cols = [c for c in df.columns if c.upper().startswith('DE')]
        df['ra'] = pd.to_numeric(df[ra_cols[0]], errors='coerce') if ra_cols else pd.NA
        df['dec'] = pd.to_numeric(df[de_cols[0]], errors='coerce') if de_cols else pd.NA

    df['hip'] = df.get('HIP')
    df['vmag'] = pd.to_numeric(df.get('Vmag'), errors='coerce')
    df['plx'] = pd.to_numeric(df.get('Plx'), errors='coerce')  # mas

    # B-V may not exist; handle safely
    if 'B-V' in df.columns:
        df['bv'] = pd.to_numeric(df['B-V'], errors='coerce')
    else:
        df['bv'] = None

    # SpType may not exist; handle safely
    if 'SpType' in df.columns:
        df['sp_type'] = df['SpType'].astype(str).fillna('').replace('nan','').str.strip()
    else:
        df['sp_type'] = None

    df['dist_pc'] = df['plx'].apply(lambda p: 1000.0/p if pd.notna(p) and p>0 else None)

    def compute_absmag(row):
        d = row['dist_pc']; m = row['vmag']
        if pd.notna(d) and pd.notna(m) and d>0:
            return float(m - 5 * (np.log10(d) - 1))
        return None
    df['absmag'] = df.apply(compute_absmag, axis=1)

    def bv_to_temp(bv):
        try:
            if pd.isna(bv) or bv is None:
                return None
            return float(4600 * (1.0/(0.92*bv + 1.7) + 1.0/(0.92*bv + 0.62)))
        except: return None
    df['temp_k'] = df['bv'].apply(bv_to_temp)

    keep = ['hip','ra','dec','dist_pc','vmag','plx','bv','sp_type','absmag','temp_k']
    df_out = df[[c for c in keep if c in df.columns or c in ['hip','ra','dec','dist_pc','vmag','plx','bv','sp_type','absmag','temp_k']]].copy()
    df_out = df_out.dropna(subset=['ra','dec','vmag'])
    return df_out

def write_ndjson(df, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as fh:
        for _, row in tqdm(df.iterrows(), total=len(df), desc=os.path.basename(path)):
            obj = {}
            for c in df.columns:
                val = row[c]
                obj[c] = None if pd.isna(val) else (val.item() if hasattr(val, 'item') else val)
            fh.write(json.dumps(obj) + "\\n")

def main():
    df = fetch_vizier()
    df2 = normalize_and_compute(df)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Saving CSV:", CSV_OUT)
    df2.to_csv(CSV_OUT, index=False)
    print("Saving NDJSON:", NDJSON_OUT)
    write_ndjson(df2, NDJSON_OUT)
    os.makedirs('data', exist_ok=True)
    sample = df2.sample(n=min(SAMPLE_SIZE, len(df2)), random_state=42)
    write_ndjson(sample, SAMPLE_OUT)
    print("Done. NDJSON and sample created.")

if __name__ == '__main__':
    main()

