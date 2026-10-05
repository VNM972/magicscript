import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findPrototypeSourceFiles } from './prototype-source-files';

test('recursively includes separate prototype components', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magicscript-wp08-'));

  try {
    await mkdir(join(root, 'app', 'components'), {
      recursive: true,
    });

    await writeFile(
      join(root, 'app', 'page.tsx'),
      'export default function Page() { return null; }',
    );

    await writeFile(
      join(root, 'app', 'components', 'ContactForm.tsx'),
      'export function ContactForm() { return <form />; }',
    );

    const files = await findPrototypeSourceFiles(root);

    assert.deepEqual(files, [
      'app/components/ContactForm.tsx',
      'app/page.tsx',
    ]);
  } finally {
    await rm(root, {
      recursive: true,
      force: true,
    });
  }
});

test('does not traverse excluded generated directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'magicscript-wp08-'));

  try {
    await mkdir(join(root, 'app', 'node_modules'), {
      recursive: true,
    });

    await writeFile(
      join(root, 'app', 'node_modules', 'HiddenForm.tsx'),
      'export const HiddenForm = () => <form />;',
    );

    const files = await findPrototypeSourceFiles(root);

    assert.deepEqual(files, []);
  } finally {
    await rm(root, {
      recursive: true,
      force: true,
    });
  }
});