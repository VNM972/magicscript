import { execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const database = 'magicscript-dev';
const config = join('apps', 'api-worker', 'wrangler.local.jsonc');
const sqlFile = join('scripts', 'audit-local-state.sql');
const wranglerConfigHome = join(repoRoot, '.magicscript', 'xdg.config');
const snapshotPath = join(repoRoot, 'bulk', 'martinique', 'index.md');
const reportPath = join(repoRoot, 'bulk', 'reports', 'local-state-audit.json');
const now = new Date();

function parseWranglerJson(output) {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end < start) {
    throw new Error(`Wrangler n'a pas renvoyé un JSON exploitable: ${output.slice(-500)}`);
  }
  const parsed = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(parsed) || parsed.some((entry) => entry.success === false)) {
    throw new Error('La lecture D1 locale a échoué.');
  }
  return parsed;
}

function readLocalDatabase() {
  const windows = process.platform === 'win32';
  const executable = windows ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe') : 'npx';
  const args = windows
    ? ['/d', '/c', `set WRANGLER_WRITE_LOGS=false&& npx.cmd wrangler d1 execute ${database} --local --config ${config} --file ${sqlFile} --json`]
    : ['wrangler', 'd1', 'execute', database, '--local', '--config', config, '--file', sqlFile, '--json'];
  let output;
  let warning = null;
  try {
    output = execFileSync(executable, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, XDG_CONFIG_HOME: wranglerConfigHome, WRANGLER_WRITE_LOGS: 'false' },
    });
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : '';
    const stderr = error?.stderr ? String(error.stderr) : '';
    if (!stdout.includes('"success"')) {
      throw new Error(`Lecture D1 locale interrompue: ${stderr.slice(-500) || error.message}`);
    }
    output = stdout;
    warning = `Wrangler a renvoyé un code non nul malgré un JSON D1 exploitable: ${stderr.slice(-300)}`;
  }
  return { rows: parseWranglerJson(output).map((entry) => entry.results || []), warning };
}

function countRows(rows) {
  return Object.fromEntries(rows.map((row) => [row.status || row.state, Number(row.count)]));
}

function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function isMartinique(prospect) {
  const location = String(prospect.location || '').toLocaleLowerCase('fr-FR');
  return location.includes('martinique') || /\b972\d{2}\b/.test(location);
}

function pendingClassification(job) {
  const ageHours = job.run_after
    ? Math.max(0, Math.round(((now.getTime() - new Date(job.run_after).getTime()) / 3600000) * 10) / 10)
    : null;
  const error = String(job.last_error || '');
  if (job.kind === 'ESCALATE_TO_HUMAN') return { classification: 'VALID_PENDING', reason: 'attente volontaire d’une action humaine', ageHours };
  if (/cloudflare|account[_ ]?id|external|deploy/i.test(`${job.kind} ${error}`)) {
    return { classification: 'MANUAL_REVIEW', reason: 'action externe ou configuration à confirmer', ageHours };
  }
  if (ageHours !== null && ageHours > 24) return { classification: 'STALE_PENDING', reason: 'job ancien sans reprise automatique', ageHours };
  return { classification: 'VALID_PENDING', reason: 'job local éligible mais non rejoué par cet audit', ageHours };
}

function deadLetterCause(job) {
  const text = `${job.kind} ${job.last_error || ''}`.toLocaleLowerCase('fr-FR');
  if (/enomem|uv_os_get_passwd/.test(text)) return 'ENOMEM / résolution environnement';
  if (/enametoolong/.test(text)) return 'ENAMETOOLONG / longueur de commande';
  if (/cloudflare|account[_ ]?id/.test(text)) return 'configuration Cloudflare';
  if (/python311|no python|aider/.test(text)) return 'environnement Python / Aider historique';
  if (/kimi|402|credit|rate limit|429/.test(text)) return 'fournisseur Kimi / crédit ou limite';
  if (/digitalgap|undefined|callback|500/.test(text)) return 'contrat de callback / réponse inattendue';
  if (/next\.config|hello|scaffold|icon/.test(text)) return 'scaffold ou configuration Next invalide';
  if (/shutdown|stop|smoke reset/.test(text)) return 'arrêt contrôlé ou smoke reset';
  if (/synthetic|human escalation/.test(text)) return 'fixture synthétique / escalade de test';
  if (/onversion|command failed/.test(text)) return 'commande historique mal formée';
  return 'autre cause historique';
}

function readBulkSnapshot(content) {
  const lines = content.split(/\r?\n/);
  const separator = lines.findIndex((line) => /^\|\s*---/.test(line));
  if (separator < 0) return { present: true, rows: [], parseError: 'séparateur Markdown introuvable' };
  const rows = lines.slice(separator + 1)
    .filter((line) => /^\|/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((value) => value.trim().replaceAll('\\|', '|')))
    .filter((columns) => columns.length >= 10)
    .map((columns) => ({
      id: columns[0], companyName: columns[1], activity: columns[2], location: columns[3],
      state: columns[4], score: columns[5], hubId: columns[6], businessUnit: columns[7],
      masterOfWork: columns[8], websiteUrl: columns[9],
    }));
  const names = rows.map((row) => row.companyName.toLocaleLowerCase('fr-FR')).filter(Boolean);
  const missing = Object.fromEntries(['activity', 'location', 'score', 'hubId', 'businessUnit', 'masterOfWork']
    .map((field) => [field, rows.filter((row) => isEmpty(row[field]) || row[field] === 'UNKNOWN').length]));
  return {
    present: true,
    rows,
    count: rows.length,
    missing,
    duplicateCompanyNames: rows.length - new Set(names).size,
  };
}

async function checkHttp(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { available: true, status: response.status };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.code || error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve({ port, state: open ? 'LISTENING' : 'FREE' });
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1200, () => finish(false));
  });
}

async function persistReport(report) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  try {
    await writeFile(reportPath, serialized, 'utf8');
    return reportPath;
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EBUSY'].includes(error?.code)) throw error;
    const fallbackName = `local-state-audit-${process.pid}-${Date.now()}.json`;
    const fallbackPath = join(wranglerConfigHome, fallbackName);
    await writeFile(fallbackPath, serialized, 'utf8');
    return fallbackPath;
  }
}

async function main() {
  await mkdir(wranglerConfigHome, { recursive: true });
  const databaseRead = readLocalDatabase();
  const [jobStatus, nonTerminalJobs, prospectStates, prospects, runners, outreach, prototypes] = databaseRead.rows;
  const deadLetters = nonTerminalJobs.filter((job) => job.status === 'DEAD_LETTER');
  const pending = nonTerminalJobs
    .filter((job) => job.status === 'PENDING')
    .map((job) => ({ ...job, ...pendingClassification(job) }));
  const activeJobs = nonTerminalJobs.filter((job) => job.status !== 'DEAD_LETTER' && job.status !== 'PENDING');
  const activeCauses = new Set(activeJobs.map(deadLetterCause));
  const causeGroups = new Map();
  for (const job of deadLetters) {
    const cause = deadLetterCause(job);
    const group = causeGroups.get(cause) || { cause, count: 0, stillObservedInNonTerminalJobs: false, representativeErrors: [] };
    group.count += 1;
    group.stillObservedInNonTerminalJobs = activeCauses.has(cause);
    if (group.representativeErrors.length < 2 && job.last_error) group.representativeErrors.push(job.last_error);
    causeGroups.set(cause, group);
  }

  const martinique = prospects.filter(isMartinique);
  const missing = Object.fromEntries(['activity', 'location', 'score']
    .map((field) => [field, martinique.filter((prospect) => isEmpty(prospect[field])).length]));
  const names = martinique.map((prospect) => String(prospect.company_name || '').trim().toLocaleLowerCase('fr-FR')).filter(Boolean);
  const bulk = await readFile(snapshotPath, 'utf8').then(readBulkSnapshot).catch(() => ({ present: false, rows: [] }));
  const [apiHealth, apiPort, controlCenterPort] = await Promise.all([
    checkHttp('http://127.0.0.1:8787/health'),
    checkPort(8787),
    checkPort(3000),
  ]);

  const report = {
    generatedAt: now.toISOString(),
    scope: {
      database,
      localOnly: true,
      mutatingOperations: false,
      requeuePerformed: false,
      externalDeployment: false,
      emailSending: false,
    },
    warnings: databaseRead.warning ? [databaseRead.warning] : [],
    queue: {
      statusCounts: countRows(jobStatus),
      pendingClassification: pending,
      activeJobs,
      deadLetterCount: deadLetters.length,
      deadLetterCauseGroups: [...causeGroups.values()],
      terminalSuccessCount: Number(jobStatus.find((row) => row.status === 'SUCCEEDED')?.count || 0),
    },
    data: {
      prospectCount: prospects.length,
      martiniqueCount: martinique.length,
      martiniqueStateCounts: countRows(prospectStates),
      martiniqueMissing: missing,
      martiniqueDuplicateCompanyNames: martinique.length - new Set(names).size,
      bulkSnapshot: {
        path: 'bulk/martinique/index.md',
        ...bulk,
      },
      outreachStatusCounts: countRows(outreach),
      prototypeStatusCounts: prototypes,
    },
    runners,
    runtime: {
      apiHealth,
      ports: [apiPort, controlCenterPort],
    },
  };

  await mkdir(dirname(reportPath), { recursive: true });
  const persistedReportPath = await persistReport(report);
  console.log(JSON.stringify({
    report: persistedReportPath.slice(repoRoot.length + 1).replaceAll('\\', '/'),
    queue: report.queue.statusCounts,
    pending: pending.map(({ id, classification }) => ({ id, classification })),
    deadLetters: report.queue.deadLetterCount,
    martinique: report.data.martiniqueCount,
    bulk: bulk.count ?? 0,
    api: apiHealth.available ? `HTTP ${apiHealth.status}` : 'STOPPED/UNAVAILABLE',
    ports: report.runtime.ports,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
