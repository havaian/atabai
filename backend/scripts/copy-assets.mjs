#!/usr/bin/env node
// Post-build asset copier - mirrors what nest-cli.json's `assets` config did
// under `nest build`. We now build with direct `tsc -p tsconfig.build.json`,
// which only emits .js/.d.ts/.js.map files; non-TS resources (seed JSON, etc.)
// need to be copied manually so they're discoverable at runtime via
// `path.join(__dirname, ...)`.
//
// Assets covered:
//   - src/admin/seedLocales/*.json  → dist/admin/seedLocales/
//   - src/mappings/**/*.json        → dist/mappings/**/*.json (none today, but
//                                     reserved so future seed JSON works)
//   - src/ledger/seedChart/*.json   → dist/ledger/seedChart/ (NSBU chart-of-
//                                     accounts seed loaded at org bootstrap)

import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COPIES = [
  { src: 'src/admin/seedLocales', dst: 'dist/admin/seedLocales', filter: (n) => n.endsWith('.json') },
  // src/mappings/ currently has no JSON, but keep the entry so adding one
  // Just Works without remembering to update this script.
  { src: 'src/mappings', dst: 'dist/mappings', filter: (n) => n.endsWith('.json') },
  { src: 'src/ledger/seedChart', dst: 'dist/ledger/seedChart', filter: (n) => n.endsWith('.json') },
];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(srcRel, dstRel, filter) {
  const srcAbs = path.resolve(ROOT, srcRel);
  const dstAbs = path.resolve(ROOT, dstRel);
  if (!(await exists(srcAbs))) return 0;

  let copied = 0;
  for (const entry of await readdir(srcAbs, { withFileTypes: true })) {
    const sPath = path.join(srcAbs, entry.name);
    const dPath = path.join(dstAbs, entry.name);
    if (entry.isDirectory()) {
      copied += await copyDir(path.join(srcRel, entry.name), path.join(dstRel, entry.name), filter);
    } else if (entry.isFile() && filter(entry.name)) {
      await mkdir(dstAbs, { recursive: true });
      await cp(sPath, dPath);
      copied++;
    }
  }
  return copied;
}

let total = 0;
for (const { src, dst, filter } of COPIES) {
  const n = await copyDir(src, dst, filter);
  if (n > 0) console.log(`copy-assets: ${n} file(s) ${src} → ${dst}`);
  total += n;
}
console.log(`copy-assets: done (${total} file${total === 1 ? '' : 's'})`);
