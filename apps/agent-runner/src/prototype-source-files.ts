import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE_EXTENSION = /\.(css|jsx?|tsx?)$/i;
const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'out',
  '.git',
]);

export async function findPrototypeSourceFiles(
  workDir: string,
): Promise<string[]> {
  const matches: string[] = [];
  const queue = ['app'];

  while (queue.length > 0) {
    const relativeDir = queue.shift() ?? 'app';

    let entries;
    try {
      entries = await readdir(join(workDir, relativeDir), {
        withFileTypes: true,
      });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const relativePath = `${relativeDir}/${entry.name}`;

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
          queue.push(relativePath);
        }
        continue;
      }

      if (
        entry.isFile() &&
        SOURCE_EXTENSION.test(entry.name)
      ) {
        matches.push(relativePath);
      }
    }
  }

  return matches.sort();
}