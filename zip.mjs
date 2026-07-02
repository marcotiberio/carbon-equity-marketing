// Zips each built creative into dist/<size>.zip, ready to upload to Google Ads.
// Best-effort: uses the system `zip` binary (present on macOS/Linux). Run
// `npm run zip` (it builds first).
import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');

const entries = await readdir(DIST);
for (const name of entries) {
  const dir = join(DIST, name);
  if (!(await stat(dir)).isDirectory()) continue;
  try {
    await run('zip', ['-r', '-q', `../${name}.zip`, '.'], { cwd: dir });
    console.log(`zipped dist/${name}.zip`);
  } catch (e) {
    console.error(`could not zip ${name} (is the \`zip\` command installed?): ${e.message}`);
  }
}
