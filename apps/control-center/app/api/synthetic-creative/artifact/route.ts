import { readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { NextResponse } from 'next/server';

const runnerRoot = resolve(process.env.MAGICSCRIPT_RUNNER_WORK_DIR ?? resolve(process.cwd(), '..', '..', '.magicscript', 'runner'));

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function safeArtifactPath(value: string): string | null {
  const candidate = resolve(value);
  const relativePath = relative(runnerRoot, candidate);
  if (!relativePath || relativePath.startsWith('..') || relativePath.includes(':')) return null;
  const pathSegments = relativePath.split(/[\\/]/);
  const isArtifactOutput = pathSegments.includes('out');
  const isCanonicalQaReport =
    pathSegments.length === 4 &&
    pathSegments[0] === 'prototypes' &&
    Boolean(pathSegments[1]) &&
    pathSegments[2] === 'qa-evidence' &&
    pathSegments[3] === 'qa-result.json';
  if (!isArtifactOutput && !isCanonicalQaReport) return null;
  return candidate;
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get('path');
  if (!value) return new NextResponse('Artifact path is required', { status: 400 });

  const artifactPath = safeArtifactPath(value);
  if (!artifactPath) return new NextResponse('Artifact path is not allowed', { status: 400 });

  try {
    const file = await stat(artifactPath);
    if (!file.isFile()) return new NextResponse('Artifact is not a file', { status: 404 });
    const content = await readFile(artifactPath);
    return new NextResponse(content, {
      headers: {
        'content-type': contentTypes[extname(artifactPath)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Artifact not found', { status: 404 });
  }
}
