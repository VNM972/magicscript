import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Script } from 'node:vm';

export interface PrototypeScaffoldRepair {
  repaired: boolean;
  files: string[];
}

function fallbackPackage(name: string): string {
  return `${JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        next: '14.2.0',
        react: '18.3.1',
        'react-dom': '18.3.1',
      },
      devDependencies: {
        '@types/node': '20.14.10',
        '@types/react': '18.3.3',
        '@types/react-dom': '18.3.0',
        typescript: '5.5.4',
      },
    },
    null,
    2,
  )}\n`;
}

const fallbackNextConfig = [
  "/** @type {import('next').NextConfig} */",
  'module.exports = {',
  "  output: 'export',",
  '  images: { unoptimized: true },',
  "  trailingSlash: true,",
  '};',
  '',
].join('\n');

const fallbackNextConfigMjs = [
  "/** @type {import('next').NextConfig} */",
  'const nextConfig = {',
  "  output: 'export',",
  '  images: { unoptimized: true },',
  "  trailingSlash: true,",
  '};',
  '',
  'export default nextConfig;',
  '',
].join('\n');

const fallbackLayout = [
  "import type { Metadata } from 'next';",
  '',
  'export const metadata: Metadata = {',
  "  title: 'Prototype de démonstration',",
  "  description: 'Prototype web préparé par Magic Script.',",
  '};',
  '',
  'export default function RootLayout({',
  '  children,',
  '}: Readonly<{',
  '  children: React.ReactNode;',
  '}>) {',
  '  return (',
  '    <html lang="fr">',
  '      <body>{children}</body>',
  '    </html>',
  '  );',
  '}',
  '',
].join('\n');

const fallbackComponents = [
  "import type { ReactNode } from 'react';",
  '',
  'export function Hero() {',
  '  return (',
  '    <section aria-label="Présentation">',
  '      <p>Prototype de démonstration</p>',
  '      <h1>Une présentation plus claire, prête à explorer.</h1>',
  '    </section>',
  '  );',
  '}',
  '',
  'export function Section({ title, children }: { title: string; children?: ReactNode }) {',
  '  return (',
  '    <section aria-labelledby={title}>',
  '      <h2 id={title}>{title}</h2>',
  '      {children ?? <p>Contenu de démonstration à préciser.</p>}',
  '    </section>',
  '  );',
  '}',
  '',
].join('\n');

function safePackageName(companyName?: string): string {
  const normalized = (companyName || 'magic-script-prototype')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${normalized || 'magic-script-prototype'}-prototype`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function readNonEmpty(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, 'utf8');
    return content.trim() ? content : null;
  } catch {
    return null;
  }
}

async function hasValidJson(path: string): Promise<boolean> {
  const content = await readNonEmpty(path);
  if (!content) return false;

  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

async function hasValidNextConfig(path: string, source: string | null): Promise<boolean> {
  if (!source) return false;
  if (path.endsWith('.js')) {
    try {
      new Script(source, { filename: path });
      return true;
    } catch {
      return false;
    }
  }

  // Keep the ESM check deliberately conservative. Next's config loader gives
  // the definitive runtime validation; this catches the common partial-agent
  // corruption where the export was omitted or the file was left blank.
  return /\bexport\s+default\b/.test(source);
}

async function appSourceFiles(appDir: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [appDir];
  while (pending.length > 0 && files.length < 80) {
    const directory = pending.shift();
    if (!directory) break;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && !['node_modules', '.next', 'out'].includes(entry.name)) {
        pending.push(path);
      } else if (entry.isFile() && /\.(css|js|jsx|ts|tsx)$/.test(entry.name)) {
        files.push(path);
      }
    }
  }
  return files;
}

async function resolveModulePath(path: string): Promise<string | null> {
  const candidates = [
    path,
    `${path}.js`,
    `${path}.jsx`,
    `${path}.ts`,
    `${path}.tsx`,
    join(path, 'index.js'),
    join(path, 'index.jsx'),
    join(path, 'index.ts'),
    join(path, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue checking the remaining resolution candidates.
    }
  }
  return null;
}

async function moduleExistsWithoutExtension(path: string): Promise<boolean> {
  return (await resolveModulePath(path)) !== null;
}

function stubModuleSource(namedImports: string[], defaultImport?: string): string {
  const lines = [
    "import type { ReactNode } from 'react';",
    '',
  ];
  for (const name of namedImports) {
    if (name === 'hello') {
      lines.push("export function hello(): string { return 'Prototype de démonstration'; }");
    } else if (/^[A-Za-z_$][\w$]*$/.test(name)) {
      lines.push(`export function ${name}(..._args: unknown[]): ReactNode { return null; }`);
    }
  }
  if (defaultImport && /^[A-Za-z_$][\w$]*$/.test(defaultImport)) {
    lines.push('', `export default function ${defaultImport}(_props: Record<string, unknown>): ReactNode { return null; }`);
  }
  lines.push('');
  return lines.join('\n');
}

function missingNamedExportSource(name: string): string {
  if (name === 'hello') {
    return "export function hello(): string { return 'Prototype de démonstration'; }";
  }
  return `export function ${name}(..._args: unknown[]): any { return null; }`;
}

async function repairMissingNamedExports(modulePath: string, namedImports: string[]): Promise<boolean> {
  if (!/\.(?:ts|tsx)$/.test(modulePath) || namedImports.length === 0) return false;
  const source = await readNonEmpty(modulePath);
  if (!source) return false;

  const missing = namedImports.filter(
    (name) => !new RegExp(`export\\s+(?:function|const|let|var|class|type|interface)\\s+${name}\\b`).test(source),
  );
  if (missing.length === 0) return false;

  await writeFile(`${modulePath}`, `${source.trimEnd()}\n\n${missing.map(missingNamedExportSource).join('\n')}\n`, 'utf8');
  return true;
}

async function repairInvalidMetadataIcons(layoutPath: string): Promise<boolean> {
  const source = await readNonEmpty(layoutPath);
  if (!source || !/\bicons\s*:\s*\[/.test(source)) return false;

  // Next's Metadata type no longer accepts the old rel/href descriptor shape
  // in this position. Dropping only that optional property keeps the layout
  // and all user-authored content intact while restoring a type-safe build.
  const repaired = source.replace(
    /\s+icons\s*:\s*\[\s*\{\s*rel\s*:\s*['"]icon['"]\s*,\s*href\s*:\s*['"][^'"]+['"]\s*,?\s*\}\s*,?\s*\]\s*,?/s,
    '',
  );
  if (repaired === source) return false;

  await writeFile(layoutPath, repaired, 'utf8');
  return true;
}

async function repairImplicitHelloImport(pagePath: string): Promise<boolean> {
  const source = await readNonEmpty(pagePath);
  if (!source || !/\bhello\s*\(\s*\)/.test(source)) return false;
  if (/^\s*import\s+(?:\{[^}]*\bhello\b[^}]*\}|hello)\s+from\s+['"]\.\/hello['"]/m.test(source)) {
    return false;
  }

  await writeFile(pagePath, `import { hello } from './hello';\n${source}`, 'utf8');
  return true;
}

async function repairBareHelloImport(appDir: string): Promise<string[]> {
  const repaired: string[] = [];
  const sources = await appSourceFiles(appDir);
  for (const sourcePath of sources) {
    const source = await readNonEmpty(sourcePath);
    if (!source || !/from\s+(['"])hello\1/.test(source)) continue;
    const repairedSource = source.replace(
      /from\s+(['"])hello\1/g,
      "from './hello'",
    );
    if (repairedSource === source) continue;
    await writeFile(sourcePath, repairedSource, 'utf8');
    repaired.push(sourcePath.slice(appDir.length + 1).replaceAll('\\', '/'));
  }
  return repaired;
}

/**
 * A partial coding-agent response can leave a valid page importing one local
 * helper that was never written. Add only a minimal module for that exact
 * missing import; preserve existing modules while repairing only named exports
 * that the partial response forgot to provide.
 */
async function ensureMissingLocalImportStubs(appDir: string): Promise<string[]> {
  const repaired: string[] = [];
  const sources = await appSourceFiles(appDir);
  for (const sourcePath of sources) {
    const source = await readNonEmpty(sourcePath);
    if (!source) continue;

    const importPattern = /^\s*import\s+(?!type\b)([\s\S]*?)\s+from\s+['"](\.\/[^'"]+)['"]/gm;
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(source))) {
      const clause = match[1].trim();
      const specifier = match[2];
      const target = join(dirname(sourcePath), specifier);
      const namedClause = clause.match(/\{([\s\S]*?)\}/)?.[1] ?? '';
      const namedImports = namedClause
        .split(',')
        .map((part) => part.trim().split(/\s+as\s+/i)[0]?.trim() ?? '')
        .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
      const defaultImport = clause.match(/^([A-Za-z_$][\w$]*)/)?.[1];
      const existingModule = await resolveModulePath(target);
      if (existingModule) {
        if (await repairMissingNamedExports(existingModule, namedImports)) {
          repaired.push(existingModule.slice(appDir.length + 1).replaceAll('\\', '/'));
        }
        continue;
      }

      const stubPath = `${target}.tsx`;
      await writeFile(stubPath, stubModuleSource(namedImports, defaultImport), 'utf8');
      repaired.push(stubPath.slice(appDir.length + 1).replaceAll('\\', '/'));
    }
  }
  return repaired;
}

/**
 * Restores only a missing, empty, or invalid scaffold file after a partial
 * agent edit. Non-empty generated files are preserved.
 */
export async function ensurePrototypeScaffold(
  cwd: string,
  companyName?: string,
): Promise<PrototypeScaffoldRepair> {
  const appDir = join(cwd, 'app');
  await mkdir(appDir, { recursive: true });

  const repaired: string[] = [];
  const packagePath = join(cwd, 'package.json');
  if (!(await hasValidJson(packagePath))) {
    await writeFile(packagePath, fallbackPackage(safePackageName(companyName)), 'utf8');
    repaired.push('package.json');
  }

  const configJsPath = join(cwd, 'next.config.js');
  const configMjsPath = join(cwd, 'next.config.mjs');
  const configJsSource = await readNonEmpty(configJsPath);
  const configMjsSource = await readNonEmpty(configMjsPath);
  if (configJsSource && !(await hasValidNextConfig(configJsPath, configJsSource))) {
    await writeFile(configJsPath, fallbackNextConfig, 'utf8');
    repaired.push('next.config.js');
  } else if (configMjsSource && !(await hasValidNextConfig(configMjsPath, configMjsSource))) {
    await writeFile(configMjsPath, fallbackNextConfigMjs, 'utf8');
    repaired.push('next.config.mjs');
  } else if (!configJsSource && !configMjsSource) {
    await writeFile(configJsPath, fallbackNextConfig, 'utf8');
    repaired.push('next.config.js');
  }

  const layoutPath = join(appDir, 'layout.tsx');
  if (!(await readNonEmpty(layoutPath))) {
    await writeFile(layoutPath, fallbackLayout, 'utf8');
    repaired.push('app/layout.tsx');
  }

  const pagePath = join(appDir, 'page.tsx');
  const pageSource = await readNonEmpty(pagePath);
  if (!pageSource || !/\bexport\s+default\b/.test(pageSource)) {
    const title = escapeHtml(companyName?.trim() || 'Prototype de démonstration');
    await writeFile(
      pagePath,
      [
        'export default function Page() {',
        '  return (',
        '    <main>',
        `      <h1>${title}</h1>`,
        '      <p>Présentation préparée pour validation.</p>',
        '    </main>',
        '  );',
        '}',
        '',
      ].join('\n'),
      'utf8',
    );
    repaired.push('app/page.tsx');
  }

  if (await repairInvalidMetadataIcons(layoutPath)) repaired.push('app/layout.tsx');
  if (await repairImplicitHelloImport(pagePath)) repaired.push('app/page.tsx');
  for (const file of await repairBareHelloImport(appDir)) {
    if (!repaired.includes(`app/${file}`)) repaired.push(`app/${file}`);
  }

  const componentCandidates = [
    join(appDir, 'components.tsx'),
    join(appDir, 'components.ts'),
    join(appDir, 'components.jsx'),
    join(appDir, 'components.js'),
  ];
  const sourceNeedsComponents = [layoutPath, pagePath];
  let importsComponents = false;
  for (const sourcePath of sourceNeedsComponents) {
    const source = await readNonEmpty(sourcePath);
    if (source && /from\s+['"]\.\/components['"]/.test(source)) {
      importsComponents = true;
      break;
    }
  }
  const hasComponents = (await Promise.all(componentCandidates.map(readNonEmpty))).some(Boolean);
  if (importsComponents && !hasComponents) {
    await writeFile(join(appDir, 'components.tsx'), fallbackComponents, 'utf8');
    repaired.push('app/components.tsx');
  }

  const missingImportStubs = await ensureMissingLocalImportStubs(appDir);
  for (const file of missingImportStubs) {
    if (!repaired.includes(`app/${file}`)) repaired.push(`app/${file}`);
  }

  return { repaired: repaired.length > 0, files: repaired };
}
