import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensurePrototypeScaffold } from './prototype-scaffold';

const makeTestRoot = () => mkdtemp(join(tmpdir(), 'magicscript-prototype-scaffold-test-'));

test('prototype scaffold repairs partial agent output without inventing over valid files', async () => {
  const root = await makeTestRoot();
  try {
    await writeFile(join(root, 'package.json'), '', 'utf8');
    await writeFile(join(root, 'next.config.js'), '', 'utf8');

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.equal(result.repaired, true);
    assert.deepEqual(result.files, [
      'package.json',
      'next.config.js',
      'app/layout.tsx',
      'app/page.tsx',
    ]);

    const packageJson = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    ) as { scripts?: { build?: string }; private?: boolean };
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.scripts?.build, 'next build');

    const page = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
    assert.match(page, /Entreprise test/);

    const second = await ensurePrototypeScaffold(root, 'Changed name');
    assert.equal(second.repaired, false);
    assert.equal(
      await readFile(join(root, 'app', 'page.tsx'), 'utf8'),
      page,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prototype scaffold replaces malformed JSON but keeps a valid config', async () => {
  const root = await makeTestRoot();
  try {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{', 'utf8');
    await writeFile(join(root, 'next.config.mjs'), 'export default {};\n', 'utf8');
    await writeFile(join(root, 'app', 'layout.tsx'), 'export default function Layout() { return null; }\n', 'utf8');
    await writeFile(join(root, 'app', 'page.tsx'), 'export default function Page() { return null; }\n', 'utf8');

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.deepEqual(result.files, ['package.json']);
    assert.equal(
      await readFile(join(root, 'next.config.mjs'), 'utf8'),
      'export default {};\n',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prototype scaffold repairs a syntactically invalid next config left by a partial agent edit', async () => {
  const root = await makeTestRoot();
  try {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }), 'utf8');
    await writeFile(
      join(root, 'next.config.js'),
      "module.exports = { output: 'export' };\n  output: 'export',\n",
      'utf8',
    );
    await writeFile(join(root, 'app', 'layout.tsx'), 'export default function Layout() { return null; }\n', 'utf8');
    await writeFile(join(root, 'app', 'page.tsx'), 'export default function Page() { return null; }\n', 'utf8');

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.deepEqual(result.files, ['next.config.js']);
    const repaired = await readFile(join(root, 'next.config.js'), 'utf8');
    assert.match(repaired, /module\.exports = \{/);
    assert.equal(repaired.split('output:').length - 1, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prototype scaffold repairs partial metadata and implicit helper references', async () => {
  const root = await makeTestRoot();
  try {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }), 'utf8');
    await writeFile(join(root, 'next.config.js'), 'module.exports = { output: \'export\' };\n', 'utf8');
    await writeFile(
      join(root, 'app', 'layout.tsx'),
      "import { hello } from './hello';\nexport const metadata = {\n  icons: [\n    {\n      rel: 'icon',\n      href: '/favicon.ico',\n    },\n  ],\n};\nexport default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{hello()}{children}</body></html>; }\n",
      'utf8',
    );
    await writeFile(join(root, 'app', 'page.tsx'), 'export default function Page() { hello(); return <main />; }\n', 'utf8');

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.equal(result.files.includes('app/layout.tsx'), true);
    assert.equal(result.files.includes('app/page.tsx'), true);
    assert.equal(result.files.includes('app/hello.tsx'), true);
    assert.doesNotMatch(await readFile(join(root, 'app', 'layout.tsx'), 'utf8'), /icons\s*:/);
    assert.match(await readFile(join(root, 'app', 'page.tsx'), 'utf8'), /import \{ hello \} from '\.\/hello'/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prototype scaffold makes a bare hello helper import local', async () => {
  const root = await makeTestRoot();
  try {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }), 'utf8');
    await writeFile(join(root, 'next.config.js'), 'module.exports = { output: \'export\' };\n', 'utf8');
    await writeFile(
      join(root, 'app', 'layout.tsx'),
      "import { hello } from 'hello';\nexport default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{hello()}{children}</body></html>; }\n",
      'utf8',
    );
    await writeFile(join(root, 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n', 'utf8');

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.equal(result.files.includes('app/layout.tsx'), true);
    assert.equal(result.files.includes('app/hello.tsx'), true);
    assert.match(await readFile(join(root, 'app', 'layout.tsx'), 'utf8'), /from '\.\/hello'/);
    assert.match(await readFile(join(root, 'app', 'hello.tsx'), 'utf8'), /export function hello/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prototype scaffold makes a bare hello import local even without a helper call', async () => {
  const root = await makeTestRoot();
  try {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }), 'utf8');
    await writeFile(join(root, 'next.config.js'), 'module.exports = { output: \'export\' };\n', 'utf8');
    await writeFile(
      join(root, 'app', 'layout.tsx'),
      "import { Navigation } from 'hello'; export default function Layout({ children }: { children: React.ReactNode }) { return <html><body><Navigation />{children}</body></html>; }\n",
      'utf8',
    );
    await writeFile(join(root, 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n', 'utf8');

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.equal(result.files.includes('app/layout.tsx'), true);
    assert.equal(result.files.includes('app/hello.tsx'), true);
    assert.match(await readFile(join(root, 'app', 'layout.tsx'), 'utf8'), /from '\.\/hello'/);
    assert.match(await readFile(join(root, 'app', 'hello.tsx'), 'utf8'), /export function Navigation/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prototype scaffold repairs a missing relative helper imported by the agent output', async () => {
  const root = await makeTestRoot();
  try {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }), 'utf8');
    await writeFile(join(root, 'next.config.js'), 'module.exports = { output: \'export\' };\n', 'utf8');
    await writeFile(
      join(root, 'app', 'layout.tsx'),
      "import { hello } from './hello'; export default function Layout({ children }: { children: React.ReactNode }) { return <html><body><h1>{hello()}</h1>{children}</body></html>; }\n",
      'utf8',
    );
    await writeFile(join(root, 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n', 'utf8');

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.deepEqual(result.files, ['app/hello.tsx']);
    assert.match(await readFile(join(root, 'app', 'hello.tsx'), 'utf8'), /export function hello/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prototype scaffold repairs a malformed local helper after a type-only import', async () => {
  const root = await makeTestRoot();
  try {
    await mkdir(join(root, 'app'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'next build' } }), 'utf8');
    await writeFile(join(root, 'next.config.js'), 'module.exports = { output: \'export\' };\n', 'utf8');
    await writeFile(
      join(root, 'app', 'layout.tsx'),
      "import type { Metadata } from 'next';\nimport { hello } from './hello';\nexport const metadata: Metadata = {};\nexport default function Layout({ children }: { children: React.ReactNode }) { return <html><body><h1>{hello()}</h1>{children}</body></html>; }\n",
      'utf8',
    );
    await writeFile(join(root, 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n', 'utf8');
    await writeFile(
      join(root, 'app', 'hello.tsx'),
      "import type { ReactNode } from 'react';\nexport default function Placeholder(): ReactNode { return null; }\n",
      'utf8',
    );

    const result = await ensurePrototypeScaffold(root, 'Entreprise test');

    assert.deepEqual(result.files, ['app/hello.tsx']);
    assert.match(await readFile(join(root, 'app', 'hello.tsx'), 'utf8'), /export function hello/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
