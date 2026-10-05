import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCreativeReviewReworkLoop, reviewCreativePrototype } from './prototype-creative-loop';

test('creative review requests rework, modifies local files, and rereviews', async () => {
  const root = await mkdtemp(join(process.cwd(), 'tmp-creative-'));
  await mkdir(join(root, 'app'));
  await writeFile(join(root, 'app', 'page.tsx'), '<main><h1>Le site</h1><div className="card card card card card card card card card">Contact</div></main>');
  await writeFile(join(root, 'app', 'globals.css'), '.card { display:grid; }');
  const before = await reviewCreativePrototype(root);
  assert.equal(before.status, 'REWORK');
  const result = await runCreativeReviewReworkLoop(root);
  assert.equal(result.rebuilt, true);
  assert.deepEqual(result.after.filesChanged, ['app/globals.css']);
  assert.notEqual(await readFile(join(root, 'app', 'globals.css'), 'utf8'), '.card { display:grid; }');
});

test('creative review does not invent facts or rewrite page content', async () => {
  const root = await mkdtemp(join(process.cwd(), 'tmp-creative-safe-'));
  await mkdir(join(root, 'app'));
  const page = '<main><h1>Verified title</h1><h2>Verified section</h2><a href="/sales-room">Découvrir</a></main>';
  await writeFile(join(root, 'app', 'page.tsx'), page);
  await writeFile(join(root, 'app', 'globals.css'), '@media (max-width: 40rem) {}');
  const review = await reviewCreativePrototype(root);
  assert.equal(review.status, 'PASS');
  assert.equal(await readFile(join(root, 'app', 'page.tsx'), 'utf8'), page);
});
