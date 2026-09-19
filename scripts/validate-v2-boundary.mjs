import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'config', 'magicscript-v2-boundary.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allowed = new Set(['KEEP', 'ADAPT', 'QUARANTINE', 'REMOVE', 'NEW_V2']);
if (!/^V2-M(?:00[1-9]|010)$/.test(manifest.mission)) throw new Error('Boundary mission must be a supported V2 mission from V2-M001 through V2-M010');
if (!Array.isArray(manifest.components) || manifest.components.length === 0) throw new Error('Boundary components missing');
const ids = new Set();
for (const component of manifest.components) {
  for (const key of ['id', 'classification', 'paths', 'rationale', 'activeRuntimeAllowed']) {
    if (!(key in component)) throw new Error(`Component ${component.id ?? '<unknown>'} missing ${key}`);
  }
  if (ids.has(component.id)) throw new Error(`Duplicate component id: ${component.id}`);
  ids.add(component.id);
  if (!allowed.has(component.classification)) throw new Error(`Invalid classification: ${component.classification}`);
  if (!Array.isArray(component.paths)) throw new Error(`Paths must be an array: ${component.id}`);
  for (const relativePath of component.paths) {
    if (!fs.existsSync(path.join(root, relativePath))) throw new Error(`Declared path does not exist: ${relativePath}`);
  }
}
const boundary = fs.readFileSync(path.join(root, 'docs', 'magicscript-v2-boundary.md'), 'utf8');
for (const required of ['Canonical future funnel', 'operator send', 'engagement', 'IMAP', 'sites/magicscript-v2', 'NEW_V2']) {
  if (!boundary.toLowerCase().includes(required.toLowerCase())) throw new Error(`Boundary document missing: ${required}`);
}
console.log(`V2 boundary valid: ${manifest.components.length} components; all declared paths exist.`);
