// Build step: content.json + templates -> dist/<size>/ upload-ready creatives
// plus dist/<size>.zip (HTML + only the assets that creative references) ready
// to upload to Google Ads. Each zip is fully self-contained, as GDN requires.
//
// Run: npm run build
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from './render.mjs';
import { makeZip, referencedAssets } from './zip.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const enc = new TextEncoder();

async function main() {
  const content = JSON.parse(await readFile(join(ROOT, 'content.json'), 'utf8'));
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const sizes = Object.keys(content.banners);
  const bundle = []; // every file, prefixed with <size>/, for one "download all" zip

  for (const size of sizes) {
    const banner = content.banners[size];
    const template = await readFile(join(ROOT, 'templates', `${size}.html`), 'utf8');
    const html = render(template, banner.fields, { clickUrl: content.clickUrl });

    // Collect the creative's files (index.html + referenced assets) once, then
    // use that same list to write the folder and the zip.
    const files = [{ name: 'index.html', data: enc.encode(html) }];
    for (const rel of referencedAssets(html)) {
      files.push({ name: rel, data: await readFile(join(ROOT, 'assets', rel)) });
    }

    const outDir = join(DIST, size);
    await mkdir(outDir, { recursive: true });
    for (const f of files) {
      const dest = join(outDir, f.name);
      await mkdir(dirname(dest), { recursive: true });
      if (f.name === 'index.html') await writeFile(dest, html);
      else await copyFile(join(ROOT, 'assets', f.name), dest);
      bundle.push({ name: `${size}/${f.name}`, data: f.data });
    }

    await writeFile(join(DIST, `${size}.zip`), makeZip(files));
    console.log(`built dist/${size}/ + ${size}.zip  (${files.length} files)`);
  }

  await writeFile(join(DIST, 'carbon-equity-banners.zip'), makeZip(bundle));
  await writeFile(join(DIST, 'index.html'), gallery(content, sizes));
  console.log(`\nbuilt dist/carbon-equity-banners.zip (all creatives)`);
  console.log(`built dist/index.html (preview gallery)`);
  console.log(`done — ${sizes.length} creatives in dist/`);
}

function gallery(content, sizes) {
  const dims = (s) => s.split('x').map(Number);
  const cards = sizes
    .map((s) => {
      const [w, h] = dims(s);
      const label = content.banners[s].label || '';
      return `    <div class="unit">
      <h2>${s} — ${label} <a class="dl" href="${s}.zip" download>↓ zip</a></h2>
      <iframe class="frame" src="${s}/index.html" width="${w}" height="${h}" scrolling="no"></iframe></div>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Carbon Equity — GDN banner previews</title>
<style>
  body{margin:0;padding:32px;background:#f3f2f4;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#2e0f2b}
  h1{font-size:20px;margin:0 0 4px}
  p.lead{margin:0 0 28px;color:#6b5566;font-size:14px}
  .grid{display:flex;flex-wrap:wrap;gap:36px;align-items:flex-start}
  .unit h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b5566;margin:0 0 8px;display:flex;align-items:center;gap:10px}
  .dl{text-transform:none;letter-spacing:0;font-weight:500;color:#fff;background:#e88d89;border-radius:5px;padding:2px 8px;text-decoration:none}
  .frame{border:0;display:block;box-shadow:0 6px 20px rgba(46,15,43,.15);border-radius:4px}
</style>
</head>
<body>
  <h1>Carbon Equity — Google Display Network banners</h1>
  <p class="lead">Built from content.json · <a href="carbon-equity-banners.zip" download>download all as one zip</a> · <a href="../editor/">open the copy editor</a></p>
  <div class="grid">
${cards}
  </div>
</body>
</html>
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
