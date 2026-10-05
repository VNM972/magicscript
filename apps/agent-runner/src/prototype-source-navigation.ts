import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SourceNavigationKind =
  | 'navigation'
  | 'content_block'
  | 'conversion_cta';

export interface SourceNavigationBlock {
  label: string;
  kind: SourceNavigationKind;
}

const SOURCE_NAVIGATION_KINDS = new Set<SourceNavigationKind>([
  'navigation',
  'content_block',
  'conversion_cta',
]);

export function extractSourceNavigationBlocks(
  value: unknown,
): SourceNavigationBlock[] {
  if (!Array.isArray(value)) return [];

  const blocks: SourceNavigationBlock[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { label, kind } = item as { label?: unknown; kind?: unknown };
    if (
      typeof label !== 'string' ||
      !label.trim() ||
      typeof kind !== 'string' ||
      !SOURCE_NAVIGATION_KINDS.has(kind as SourceNavigationKind)
    ) {
      continue;
    }

    const block = {
      label: label.trim(),
      kind: kind as SourceNavigationKind,
    };
    const key = `${block.kind}\u0000${block.label.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(block);
  }

  return blocks;
}

function serializeSourceNavigationBlocks(
  blocks: readonly SourceNavigationBlock[],
): string {
  return [
    'const sourceNavigationBlocks = [',
    ...blocks.map(
      (block) =>
        `  { label: ${JSON.stringify(block.label)}, kind: ${JSON.stringify(block.kind)} },`,
    ),
    '];',
  ].join('\n');
}

/**
 * Forward-pipeline preparation may update an existing design-owned data model,
 * but it must never append a generic visible grid merely to make parity pass.
 */
export async function prepareSourceNavigationReferences(
  workDir: string,
  blocks: readonly SourceNavigationBlock[],
): Promise<{ patched: boolean; blockCount: number }> {
  if (blocks.length === 0) return { patched: false, blockCount: 0 };

  const pagePath = join(workDir, 'app', 'page.tsx');
  let source: string;
  try {
    source = await readFile(pagePath, 'utf8');
  } catch {
    return { patched: false, blockCount: blocks.length };
  }

  const arrayPattern =
    /const sourceNavigationBlocks\s*=\s*\[[\s\S]*?\];/;
  if (!arrayPattern.test(source)) {
    return { patched: false, blockCount: blocks.length };
  }

  const nextSource = source.replace(
    arrayPattern,
    serializeSourceNavigationBlocks(blocks),
  );
  const patched = nextSource !== source;
  if (patched) {
    await writeFile(pagePath, nextSource, 'utf8');
  }

  return { patched, blockCount: blocks.length };
}

export function findMissingSourceNavigationBlocks(
  sourceSnapshot: string,
  blocks: readonly SourceNavigationBlock[],
): SourceNavigationBlock[] {
  const normalizedSource = sourceSnapshot.toLocaleLowerCase();
  return blocks.filter(
    (block) => !normalizedSource.includes(block.label.toLocaleLowerCase()),
  );
}
