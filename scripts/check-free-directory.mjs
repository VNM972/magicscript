const url = new URL('https://recherche-entreprises.api.gouv.fr/search');

url.searchParams.set('departement', '972');
url.searchParams.set('etat_administratif', 'A');
url.searchParams.set(
  'section_activite_principale',
  'F,G,I,L,M,N,R,S',
);
url.searchParams.set('page', '1');
url.searchParams.set('per_page', '3');
url.searchParams.set('minimal', 'true');
url.searchParams.set('include', 'matching_etablissements');
url.searchParams.set('limite_matching_etablissements', '10');

const response = await fetch(url, {
  headers: {
    accept: 'application/json',
    'user-agent': 'MagicScript/0.2 (+https://magicscript.fr)',
  },
});

if (!response.ok) {
  throw new Error(
    `API Recherche d'entreprises failed ${response.status}: ${await response.text()}`,
  );
}

const payload = await response.json();
const results = Array.isArray(payload.results) ? payload.results : [];
const local = [];

for (const company of results) {
  const establishment = (company.matching_etablissements || []).find((item) => {
    if (item.etat_administratif === 'F') return false;
    if (item.departement) return item.departement === '972';
    return item.code_postal?.startsWith('972');
  });

  if (!establishment) continue;

  local.push({
    siren: company.siren,
    siret: establishment.siret,
    company:
      establishment.nom_commercial ||
      establishment.liste_enseignes?.find(Boolean) ||
      company.nom_complet ||
      company.nom_raison_sociale,
    activity:
      establishment.activite_principale ||
      company.activite_principale,
    address: establishment.adresse,
    department: establishment.departement,
  });
}

console.log('Magic Script free discovery API check');
console.log(`HTTP: ${response.status}`);
console.log(`Legal units returned: ${results.length}`);
console.log(`Verified local establishments: ${local.length}`);
console.log(`Total matching legal units: ${payload.total_results ?? 'unknown'}`);
console.log('');

for (const company of local) {
  console.log(JSON.stringify(company, null, 2));
}

if (!results.length) {
  throw new Error('The free API responded but returned no results');
}

if (!local.length) {
  throw new Error(
    'The API returned legal units but no matching active establishment in department 972',
  );
}

if (
  local.some(
    (company) =>
      company.department &&
      company.department !== '972',
  )
) {
  throw new Error('Preflight accepted an establishment outside Martinique');
}

console.log('');
console.log(
  'FREE API CHECK PASSED — verified 972 establishments, no key and no paid API used.',
);
