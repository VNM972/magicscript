export interface SireneAddress {
  numeroVoieEtablissement?: string | null;
  indiceRepetitionEtablissement?: string | null;
  typeVoieEtablissement?: string | null;
  libelleVoieEtablissement?: string | null;
  codePostalEtablissement?: string | null;
  libelleCommuneEtablissement?: string | null;
  codeCommuneEtablissement?: string | null;
}

export interface SirenePeriod {
  etatAdministratifEtablissement?: 'A' | 'F' | string;
  enseigne1Etablissement?: string | null;
  denominationUsuelleEtablissement?: string | null;
  activitePrincipaleEtablissement?: string | null;
}

export interface SireneLegalUnit {
  denominationUniteLegale?: string | null;
  categorieJuridiqueUniteLegale?: string | null;
}

export interface SireneEstablishment {
  siren: string;
  siret: string;
  dateCreationEtablissement?: string | null;
  etablissementSiege?: boolean;
  uniteLegale?: SireneLegalUnit;
  adresseEtablissement?: SireneAddress;
  periodesEtablissement?: SirenePeriod[];
}

export interface SireneSearchPage {
  total: number;
  cursor?: string;
  nextCursor?: string;
  establishments: SireneEstablishment[];
}

interface SireneApiResponse {
  header?: {
    statut?: number;
    message?: string;
    total?: number;
    curseur?: string;
    curseurSuivant?: string;
  };
  etablissements?: SireneEstablishment[];
}

export class SireneApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SireneApiError';
  }
}

export class InseeSireneClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.insee.fr/api-sirene/3.11',
  ) {}

  async searchEstablishments(input: {
    query: string;
    number?: number;
    cursor?: string;
    sort?: string;
  }): Promise<SireneSearchPage> {
    const url = new URL(`${this.baseUrl}/siret`);
    url.searchParams.set('q', input.query);
    url.searchParams.set(
      'nombre',
      String(Math.max(1, Math.min(input.number ?? 100, 1000))),
    );
    url.searchParams.set('curseur', input.cursor?.trim() || '*');

    if (input.sort?.trim()) {
      url.searchParams.set('tri', input.sort.trim());
    }

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'X-INSEE-Api-Key-Integration': this.apiKey,
      },
    });

    const body = (await response.json().catch(() => ({}))) as SireneApiResponse;

    if (!response.ok) {
      throw new SireneApiError(
        body.header?.message ||
          response.statusText ||
          'INSEE Sirene API error',
        response.status,
      );
    }

    return {
      total: Number(body.header?.total ?? 0),
      cursor: body.header?.curseur,
      nextCursor: body.header?.curseurSuivant,
      establishments: Array.isArray(body.etablissements)
        ? body.etablissements
        : [],
    };
  }
}

export function currentSirenePeriod(
  establishment: SireneEstablishment,
): SirenePeriod | undefined {
  return (
    establishment.periodesEtablissement?.find(
      (period) => period.etatAdministratifEtablissement === 'A',
    ) ?? establishment.periodesEtablissement?.[0]
  );
}

export function sireneBusinessName(
  establishment: SireneEstablishment,
): string | undefined {
  const period = currentSirenePeriod(establishment);
  const candidates = [
    period?.enseigne1Etablissement,
    period?.denominationUsuelleEtablissement,
    establishment.uniteLegale?.denominationUniteLegale,
  ];

  return candidates
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));
}

export function sireneLocation(
  establishment: SireneEstablishment,
): string | undefined {
  const address = establishment.adresseEtablissement;
  const city = address?.libelleCommuneEtablissement?.trim();
  const postalCode = address?.codePostalEtablissement?.trim();

  if (postalCode && city) return `${postalCode} ${city}`;
  return city || postalCode || undefined;
}

export function isMagicScriptTargetActivity(code?: string | null): boolean {
  if (!code) return false;

  const prefixes = [
    '41', '42', '43',
    '45', '47',
    '55', '56',
    '68',
    '71', '73', '74', '77', '79',
    '81',
    '90', '91', '93',
    '95', '96',
  ];

  return prefixes.some((prefix) => code.startsWith(prefix));
}

export function sirenePublicSourceUrl(siret: string): string {
  return `https://annuaire-entreprises.data.gouv.fr/etablissement/${encodeURIComponent(siret)}`;
}
