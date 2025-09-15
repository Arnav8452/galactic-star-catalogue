import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";

const gzip = promisify(zlib.gzip);

async function main() {
  try {
    const argv = process.argv.slice(2);
    if (argv.length < 1) {
      console.error("Usage: node scripts/tile_data.mjs <input.ndjson> [tile_size_deg]");
      process.exit(1);
    }

    const inputPath = path.resolve(argv[0]);
    const TILE_SIZE_DEG = Number(argv[1] ?? 4); // default 4° tiles
    const OUT_DIR = path.resolve("data", "tiles");

    // sanity
    try {
      await fs.access(inputPath);
    } catch (e) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log(`Reading input NDJSON: ${inputPath}`);
    const txt = await fs.readFile(inputPath, "utf8");
    const lines = txt.trim().split("\n").filter(Boolean);
    console.log(`Read ${lines.length} lines (stars).`);

    // parse into objects (robustly)
    const stars = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        stars.push(JSON.parse(lines[i]));
      } catch (err) {
        console.warn(`Skipping invalid JSON line ${i}: ${err.message}`);
      }
    }
    console.log(`Parsed ${stars.length} valid star records.`);

    // group into tiles map
    const tiles = new Map(); // key => array of star objects

    for (const s of stars) {
      // require ra/dec present
      const ra = Number(s?.ra);
      const dec = Number(s?.dec);
      if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;
      // normalize ra 0..360, dec -90..90 (assume provided)
      const raNorm = ((ra % 360) + 360) % 360;
      const decNorm = Math.max(-90, Math.min(90, dec));

      const tileX = Math.floor(raNorm / TILE_SIZE_DEG);
      const tileY = Math.floor((decNorm + 90) / TILE_SIZE_DEG);
      const key = `${tileX}_${tileY}`;
      if (!tiles.has(key)) tiles.set(key, []);
      tiles.get(key).push(s);
    }

    console.log(`Grouped into ${tiles.size} tiles (tile size ${TILE_SIZE_DEG}°).`);

    await fs.mkdir(OUT_DIR, { recursive: true });

    let written = 0;
    for (const [key, arr] of tiles.entries()) {
      const ndjson = arr.map((o) => JSON.stringify(o)).join("\n") + "\n";
      const outBase = path.join(OUT_DIR, key + ".ndjson");
      const outGz = outBase + ".gz";

      // write uncompressed (optional - remove if you don't want raw files)
      await fs.writeFile(outBase, ndjson, "utf8");
      // write gzipped
      const comp = await gzip(ndjson);
      await fs.writeFile(outGz, comp);
      written++;
    }

    console.log(`Wrote ${written} tiles to ${OUT_DIR}`);
    console.log("Example tile files:");
    const files = await fs.readdir(OUT_DIR);
    for (const f of files.slice(0, 10)) console.log(" - " + f);
    console.log("Done.");
  } catch (err) {
    console.error("Tile script failed:", err);
    process.exit(1);
  }
}

main();
