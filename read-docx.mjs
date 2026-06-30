import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const docx = process.argv[2];
const temp = path.join(os.tmpdir(), 'docxread');
fs.mkdirSync(temp, { recursive: true });
const zipPath = path.join(temp, 'd.zip');
const outDir = path.join(temp, 'out');
fs.copyFileSync(docx, zipPath);
execSync(
  `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outDir}' -Force"`,
  { stdio: 'inherit' }
);
const xml = fs.readFileSync(path.join(outDir, 'word', 'document.xml'), 'utf8');
const paras = xml
  .split(/<w:p[ >]/)
  .slice(1)
  .map((p) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((x) => x[1]).join(''))
  .filter(Boolean);
console.log(paras.join('\n'));
