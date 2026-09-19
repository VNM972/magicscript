import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, resolve as pathResolve } from 'node:path';
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !extname(specifier)) {
    const base = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
    for (const ext of ['.ts', '.js']) { try { await access(base + ext); return { url: pathToFileURL(base + ext).href, shortCircuit: true }; } catch {} }
  }
  return nextResolve(specifier, context);
}
