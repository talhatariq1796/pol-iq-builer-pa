/**
 * Split a large GeoJSON FeatureCollection into multiple files under a size budget
 * (default 95 MiB) and write a *.manifest.json for use with loadGeoJSONMerged().
 *
 * Usage:
 *   npx ts-node scripts/split-geojson-for-github.ts <input.geojson> [--max-mb=95] [--out-dir=...]
 *
 * Outputs (next to input, or under --out-dir — must be inside public/):
 *   <base>.part000.geojson, <base>.part001.geojson, ...
 *   <base>.manifest.json   (merge[] uses /data/... URLs under /public)
 *
 * After verifying, remove the original monolith from git and point app paths at
 * the .manifest.json file.
 */

import * as fs from "fs";
import * as path from "path";

const MiB = 1024 * 1024;

function parseArgs() {
  const argv = process.argv.slice(2);
  const positional: string[] = [];
  let maxMb = 95;
  let outDir: string | null = null;

  for (const a of argv) {
    if (a.startsWith("--max-mb=")) {
      maxMb = Number(a.slice("--max-mb=".length));
    } else if (a.startsWith("--out-dir=")) {
      outDir = a.slice("--out-dir=".length);
    } else if (!a.startsWith("-")) {
      positional.push(a);
    }
  }

  if (!positional[0]) {
    console.error(
      "Usage: npx ts-node scripts/split-geojson-for-github.ts <input.geojson> [--max-mb=95] [--out-dir=dir]",
    );
    process.exit(1);
  }

  if (!Number.isFinite(maxMb) || maxMb <= 0 || maxMb >= 100) {
    console.error("--max-mb must be a number in (0, 100), e.g. 95");
    process.exit(1);
  }

  return { inputPath: path.resolve(positional[0]), maxBytes: Math.floor(maxMb * MiB), outDir };
}

function toPublicUrl(absoluteFilePath: string, publicRoot: string): string {
  const rel = path.relative(publicRoot, absoluteFilePath);
  if (rel.startsWith("..")) {
    throw new Error(
      `Output file ${absoluteFilePath} is outside public root ${publicRoot}`,
    );
  }
  return "/" + rel.split(path.sep).join("/");
}

function assertUnderPublic(absPath: string, publicRoot: string) {
  const rel = path.relative(publicRoot, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    console.error(
      "Output path must be inside the public/ directory (Next.js static files). Got:",
      absPath,
    );
    process.exit(1);
  }
}

function main() {
  const { inputPath, maxBytes, outDir } = parseArgs();
  const publicRoot = path.join(process.cwd(), "public");

  if (!fs.existsSync(inputPath)) {
    console.error("Input not found:", inputPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const fileSize = Buffer.byteLength(raw, "utf8");
  if (fileSize <= maxBytes) {
    console.log(
      `File is ${(fileSize / MiB).toFixed(2)} MiB (under ${(maxBytes / MiB).toFixed(2)} MiB). No split needed.`,
    );
    process.exit(0);
  }

  const geo = JSON.parse(raw) as { type?: string; features?: unknown[] };
  if (geo.type !== "FeatureCollection" || !Array.isArray(geo.features)) {
    console.error("Input must be a GeoJSON FeatureCollection with features[]");
    process.exit(1);
  }

  const features = geo.features as Record<string, unknown>[];
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const dir = outDir ? path.resolve(outDir) : path.dirname(inputPath);
  assertUnderPublic(dir, publicRoot);
  assertUnderPublic(path.join(dir, `${baseName}.manifest.json`), publicRoot);
  fs.mkdirSync(dir, { recursive: true });

  const chunks: Record<string, unknown>[][] = [];
  let current: Record<string, unknown>[] = [];
  /** Serialized size of {"type":"FeatureCollection","features":[...]} without outer braces overhead — approximate using per-feature JSON. */
  let currentBodyBytes = 0;
  const wrapperOverhead = Buffer.byteLength(
    JSON.stringify({ type: "FeatureCollection", features: [] }),
    "utf8",
  );

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current);
    current = [];
    currentBodyBytes = 0;
  };

  for (const feature of features) {
    const piece = JSON.stringify(feature);
    const pieceBytes = Buffer.byteLength(piece, "utf8");

    if (wrapperOverhead + pieceBytes > maxBytes) {
      console.warn(
        "Single feature exceeds max chunk size; writing it as its own part anyway.",
      );
      flush();
      chunks.push([feature]);
      continue;
    }

    const comma = current.length > 0 ? 1 : 0;
    const wouldBe = wrapperOverhead + currentBodyBytes + comma + pieceBytes;

    if (current.length > 0 && wouldBe > maxBytes) {
      flush();
    }

    const commaAfter = current.length > 0 ? 1 : 0;
    current.push(feature);
    currentBodyBytes += commaAfter + pieceBytes;
  }
  flush();

  const mergeUrls: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const partPath = path.join(dir, `${baseName}.part${String(i).padStart(3, "0")}.geojson`);
    const fc = { type: "FeatureCollection" as const, features: chunks[i] };
    fs.writeFileSync(partPath, JSON.stringify(fc), "utf-8");
    mergeUrls.push(toPublicUrl(partPath, publicRoot));
    const st = fs.statSync(partPath);
    console.log(
      `Wrote ${partPath} (${chunks[i].length} features, ${(st.size / MiB).toFixed(2)} MiB)`,
    );
  }

  const manifestPath = path.join(dir, `${baseName}.manifest.json`);
  const manifest = { geojsonManifest: "1", merge: mergeUrls };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`Wrote manifest: ${manifestPath}`);
  console.log(
    `Point your app at: ${toPublicUrl(manifestPath, publicRoot)}`,
  );
}

main();
