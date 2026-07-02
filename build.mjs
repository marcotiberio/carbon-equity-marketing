// Build step: content.json + templates -> dist/<size>/ upload-ready creatives.
// Each creative folder is fully self-contained (HTML + only the assets it
// references) so it can be zipped and uploaded to Google Ads / GDN as-is.
//
// Run: npm run build
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from './render.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');

// Pull out local asset references (fonts, images) from a rendered banner so we
// know exactly which files to copy next to it. Skips absolute/data URLs.
function referencedAssets(html) {
  const re = /(?:url\(|src\s*[:=]\s*)['"]?([\w./-]+\.(?:woff2?|jpe?g|png|gif|svg))/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(html))) {
    if (!/^(https?:|data:|\/)/.test(m[1])) out.add(m[1]);
  }
  return [...out];
}

async function main() {
  const content = JSON.parse(await readFile(join(ROOT, 'content.json'), 'utf8'));
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const sizes = Object.keys(content.banners);
  for (const size of sizes) {
    const banner = content.banners[size];
    const template = await readFile(join(ROOT, 'templates', `${size}.html`), 'utf8');
    const html = render(template, banner.fields, { clickUrl: content.clickUrl });

    const outDir = join(DIST, size);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'index.html'), html);

    for (const rel of referencedAssets(html)) {
      const dest = join(outDir, rel);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(join(ROOT, 'assets', rel), dest);
    }
    console.log(`built dist/${size}/  (${referencedAssets(html).length} assets)`);
  }

  await writeFile(join(DIST, 'index.html'), gallery(content, sizes));
  console.log(`\nbuilt dist/index.html  (preview gallery)`);
  console.log(`done — ${sizes.length} creatives in dist/`);
}

function gallery(content, sizes) {
  const dims = (s) => s.split('x').map(Number);
  const cards = sizes
    .map((s) => {
      const [w, h] = dims(s);
      const label = content.banners[s].label || '';
      return `    <div class="unit"><h2>${s} — ${label}</h2>
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
  .unit h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b5566;margin:0 0 8px}
  .frame{border:0;display:block;box-shadow:0 6px 20px rgba(46,15,43,.15);border-radius:4px}
</style>
</head>
<body>
  <h1>Carbon Equity — Google Display Network banners</h1>
  <p class="lead">Built from content.json · live at true pixel dimensions · <a href="../editor/">open the copy editor</a></p>
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
