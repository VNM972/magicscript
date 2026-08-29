export interface RechercheEntreprisesSiege {
  siret?: string;
  activite_principale?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
  etat_administratif?: string | null;
  nom_commercial?: string | null;
  liste_enseignes?: string[] | null;
}

export interface RechercheEntreprisesResult {
  siren: string;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  etat_administratif?: string | null;
  activite_principale?: string | null;
  section_activite_principale?: string | null;
  siege?: RechercheEntreprisesSiege | null;
}

export interface RechercheEntreprisesPage {
  results: RechercheEntreprisesResult[];
  totalResults: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface ApiPayload {
  results?: RechercheEntreprisesResult[];
  total_results?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
  erreur?: string;
}

export class RechercheEntreprisesApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'RechercheEntreprisesApiError';
  }
}

export class RechercheEntreprisesClient {
  constructor(
    private readonly baseUrl = 'https://recherche-entreprises.api.gouv.fr',
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async search(input: {
    departement: string;
    sections?: string[];
    page?: number;
    perPage?: number;
  }): Promise<RechercheEntreprisesPage> {
    const url = new URL(`${this.baseUrl}/search`);

    url.searchParams.set('departement', input.departement);
    url.searchParams.set('etat_administratif', 'A');
    url.searchParams.set(
      'page',
      String(Math.max(1, Math.trunc(input.page ?? 1))),
    );
    url.searchParams.set(
      'per_page',
      String(Math.max(1, Math.min(Math.trunc(input.perPage ?? 25), 25))),
    );
    url.searchParams.set('minimal', 'true');
    url.searchParams.set('include', 'siege');

    if (input.sections?.length) {
      url.searchParams.set(
        'section_activite_principale',
        input.sections.join(','),
      );
    }

    const response = await this.fetchFn(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'MagicScript/0.2 (+https://magicscript.fr)',
      },
    });

    const payload = (await response.json().catch(() => ({}))) as ApiPayload;

    if (!response.ok) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : undefined;

      throw new RechercheEntreprisesApiError(
        payload.erreur ||
          response.statusText ||
          'API Recherche d’entreprises error',
        response.status,
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
      );
    }

    return {
      results: Array.isArray(payload.results) ? payload.results : [],
      totalResults: Number(payload.total_results ?? 0),
      page: Number(payload.page ?? input.page ?? 1),
      perPage: Number(payload.per_page ?? input.perPage ?? 25),
      totalPages: Math.max(1, Number(payload.total_pages ?? 1)),
    };
  }
}

export function rechercheEntrepriseName(
  result: RechercheEntreprisesResult,
): string | undefined {
  const candidates = [
    result.nom_complet,
    result.nom_raison_sociale,
    result.siege?.nom_commercial,
    result.siege?.liste_enseignes?.find(Boolean),
  ];

  return candidates
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

export function rechercheEntrepriseLocation(
  result: RechercheEntreprisesResult,
): string | undefined {
  const address = result.siege?.adresse?.trim();
  if (address) return address;

  const postalCode = result.siege?.code_postal?.trim();
  const city = result.siege?.libelle_commune?.trim();

  if (postalCode && city) return `${postalCode} ${city}`;
  return postalCode || city || undefined;
}

export function rechercheEntrepriseActivity(
  result: RechercheEntreprisesResult,
): string | undefined {
  return (
    result.siege?.activite_principale?.trim() ||
    result.activite_principale?.trim() ||
    undefined
  );
}

export function rechercheEntrepriseSourceUrl(siren: string): string {
  const url = new URL('https://recherche-entreprises.api.gouv.fr/search');
  url.searchParams.set('q', siren);
  return url.toString();
}
