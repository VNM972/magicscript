import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const baseUrl = (process.env.MAGICSCRIPT_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const token = process.env.MAGICSCRIPT_API_TOKEN || 'dev-api-token';
const cap = 50;

function cell(value) {
  const text = value === null || value === undefined || String(value).trim() === ''
    ? 'UNKNOWN'
    : String(value).trim();
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function ficheContent(prospect) {
  return [
    `# ${cell(prospect.companyName)}`,
    '',
    '- Fiche bulk locale issue de la D1 ; cet export ne constitue pas une validation commerciale.',
    '- Aucun contact et aucune adresse email ne sont exportés dans cette fiche.',
    '',
    '| Champ | Valeur |',
    '| --- | --- |',
    `| ID | ${cell(prospect.id)} |`,
    `| Activité | ${cell(prospect.activity)} |`,
    `| Localisation | ${cell(prospect.location)} |`,
    `| État | ${cell(prospect.state)} |`,
    `| Score | ${cell(prospect.score)} |`,
    `| Hub | ${cell(prospect.hubId)} |`,
    `| BU | ${cell(prospect.businessUnit)} |`,
    `| MO | ${cell(prospect.masterOfWork)} |`,
    `| Site enregistré | ${cell(prospect.websiteUrl)} |`,
    `| Dernière mise à jour | ${cell(prospect.updatedAt)} |`,
    '| Date de vérification publique | UNKNOWN |',
    '| Source détaillée | UNKNOWN |',
    '',
  ].join('\n');
}

function isMartinique(prospect) {
  const location = String(prospect.location || '').toLocaleLowerCase('fr-FR');
  return location.includes('martinique') || /\b972\d{2}\b/.test(location);
}

async function main() {
  const response = await fetch(`${baseUrl}/api/prospects`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Prospect export failed: HTTP ${response.status}`);

  const data = await response.json();
  const prospects = (data.prospects || [])
    .filter(isMartinique)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, cap);

  const missing = {
    activity: prospects.filter((prospect) => !String(prospect.activity || '').trim()).length,
    location: prospects.filter((prospect) => !String(prospect.location || '').trim()).length,
    score: prospects.filter((prospect) => prospect.score === null || prospect.score === undefined).length,
    hub: prospects.filter((prospect) => !String(prospect.hubId || '').trim()).length,
    businessUnit: prospects.filter((prospect) => !String(prospect.businessUnit || '').trim()).length,
    masterOfWork: prospects.filter((prospect) => !String(prospect.masterOfWork || '').trim()).length,
  };
  const duplicateNames = prospects.length - new Set(prospects.map((prospect) => String(prospect.companyName || '').trim().toLocaleLowerCase('fr-FR'))).size;
  const rows = prospects.map((prospect) =>
    `| ${cell(prospect.id)} | ${cell(prospect.companyName)} | ${cell(prospect.activity)} | ${cell(prospect.location)} | ${cell(prospect.state)} | ${cell(prospect.score)} | ${cell(prospect.hubId)} | ${cell(prospect.businessUnit)} | ${cell(prospect.masterOfWork)} | ${cell(prospect.websiteUrl)} |`,
  );
  const content = [
    '# Index bulk — prospects Martinique',
    '',
    `Snapshot local généré le ${new Date().toISOString()}.`,
    '',
    `- ${prospects.length} fiche(s) exportée(s), plafond ${cap}.`,
    '- Source : état déjà présent dans la D1 locale après découverte publique ; aucun prospect n’est créé, supprimé ou contacté par cet export.',
    '- Les fiches synthétiques restent identifiables par leur nom et ne valent pas validation commerciale.',
    '- Les contacts et adresses email ne sont pas exportés dans ce bulk.',
    `- Contrôles : activité manquante ${missing.activity}, commune/localisation manquante ${missing.location}, score manquant ${missing.score}, hub manquant ${missing.hub}, BU manquante ${missing.businessUnit}, MO manquant ${missing.masterOfWork}, doublon de nom ${duplicateNames}.`,
    '- Date de vérification publique et source détaillée : UNKNOWN lorsqu’elles ne sont pas persistées par le contrat prospect actuel.',
    '',
    '| ID | Entreprise | Activité | Localisation | État | Score | Hub | BU | MO | Site enregistré |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');

  const outputDir = join(process.cwd(), 'bulk', 'martinique');
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'index.md'), content, 'utf8');
  await Promise.all(prospects.map((prospect) =>
    writeFile(join(outputDir, `${prospect.id}.md`), ficheContent(prospect), 'utf8'),
  ));
  console.log(`Bulk snapshot written: ${prospects.length} record(s) -> bulk/martinique/index.md + individual ID fiches`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
