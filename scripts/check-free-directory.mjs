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
url.searchParams.set('include', 'siege');

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

console.log('Magic Script free discovery API check');
console.log(`HTTP: ${response.status}`);
console.log(`Results returned: ${results.length}`);
console.log(`Total matching businesses: ${payload.total_results ?? 'unknown'}`);
console.log('');

for (const company of results) {
  console.log(
    JSON.stringify(
      {
        siren: company.siren,
        company: company.nom_complet || company.nom_raison_sociale,
        activity:
          company.siege?.activite_principale ||
          company.activite_principale,
        address: company.siege?.adresse,
      },
      null,
      2,
    ),
  );
}

if (!results.length) {
  throw new Error('The free API responded but returned no Martinique businesses');
}

console.log('');
console.log('FREE API CHECK PASSED — no key and no paid API used.');
