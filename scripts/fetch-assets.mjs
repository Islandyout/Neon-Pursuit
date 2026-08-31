import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

const SOURCE_REPOSITORY = 'bevyengine/bevy_asset_files';
const SOURCE_COMMIT = '4f2b9f1a7f6064a272fb2d4886e6537bb836605e';
const SOURCE_BASE = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${SOURCE_COMMIT}/kenney`;
const ROOT = join(process.cwd(), 'public', 'assets', 'kenney');
const CHECK_ONLY = process.argv.includes('--check');

export const REQUIRED_ASSETS = [
  'car-kit/race.glb',
  'car-kit/sedan-sports.glb',
  'car-kit/hatchback-sports.glb',
  'car-kit/suv-luxury.glb',
  'car-kit/police.glb',
  'car-kit/sedan.glb',
  'car-kit/van.glb',
  'car-kit/truck.glb',
  'car-kit/Textures/colormap.png',
  'city-kit-roads/road-straight.glb',
  'city-kit-roads/road-crossroad-path.glb',
  'city-kit-roads/Textures/colormap.png',
  'city-kit-roads/Textures/variation-a.png',
  'city-kit-commercial/building-a.glb',
  'city-kit-commercial/building-c.glb',
  'city-kit-commercial/building-f.glb',
  'city-kit-commercial/building-l.glb',
  'city-kit-commercial/building-skyscraper-a.glb',
  'city-kit-commercial/building-skyscraper-c.glb',
  'city-kit-commercial/Textures/colormap.png',
  'city-kit-commercial/Textures/variation-a.png',
  'city-kit-commercial/Textures/variation-b.png'
];

const isGlb = (path) => path.endsWith('.glb');
const isPng = (path) => path.endsWith('.png');

async function validFile(path) {
  try {
    const file = await readFile(join(ROOT, path));
    if (file.byteLength < 32) return false;
    if (isGlb(path)) return file.subarray(0, 4).toString('ascii') === 'glTF';
    if (isPng(path)) return file.subarray(1, 4).toString('ascii') === 'PNG';
    return true;
  } catch {
    return false;
  }
}

async function fetchAsset(path) {
  const output = join(ROOT, path);
  if (await validFile(path)) return;
  const url = `${SOURCE_BASE}/${path}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Asset download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  if (!(await validFile(path))) throw new Error(`Downloaded asset failed signature validation: ${path}`);
  console.log(`Fetched ${path} (${bytes.byteLength} bytes)`);
}

async function verifyAll() {
  const missing = [];
  for (const path of REQUIRED_ASSETS) {
    if (!(await validFile(path))) missing.push(path);
  }
  if (missing.length) {
    throw new Error(`Required production assets are missing or corrupt:\n${missing.map((item) => ` - ${item}`).join('\n')}`);
  }
  const manifestPath = join(ROOT, 'asset-manifest.json');
  await access(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.sourceCommit !== SOURCE_COMMIT) throw new Error('Asset manifest source commit does not match pinned source commit.');
  console.log(`Verified ${REQUIRED_ASSETS.length} production assets from ${SOURCE_COMMIT}.`);
}

async function main() {
  if (!CHECK_ONLY) {
    for (const path of REQUIRED_ASSETS) await fetchAsset(path);
    await mkdir(ROOT, { recursive: true });
    await writeFile(join(ROOT, 'asset-manifest.json'), `${JSON.stringify({
      sourceRepository: SOURCE_REPOSITORY,
      sourceCommit: SOURCE_COMMIT,
      license: 'CC0-1.0 (Kenney assets)',
      generatedAt: new Date().toISOString(),
      required: REQUIRED_ASSETS
    }, null, 2)}\n`);
  }
  await verifyAll();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
