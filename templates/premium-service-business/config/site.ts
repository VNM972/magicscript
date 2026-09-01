export type ProofPoint = {
  label: string;
  value: string;
  verified: boolean;
};

export type Service = {
  title: string;
  description: string;
};

export const site = {
  isDemo: true,

  company: {
    name: "À renseigner",
    legalName: "",
    tagline: "À renseigner : proposition de valeur claire et vérifiable.",
    location: "À renseigner",
  },

  seo: {
    title: "À renseigner | Service professionnel",
    description: "À renseigner : description factuelle de l'activité et de la zone servie.",
  },

  hero: {
    eyebrow: "Service professionnel",
    title: "Une promesse claire, crédible et orientée client.",
    description:
      "Remplacer ce texte par une proposition de valeur factuelle issue de la recherche prospect.",
    primaryCta: "Demander un échange",
    secondaryCta: "Découvrir nos services",
  },

  services: [
    {
      title: "Service principal",
      description: "À renseigner avec une prestation réellement proposée par l'entreprise.",
    },
    {
      title: "Service complémentaire",
      description: "À renseigner avec une prestation réellement proposée par l'entreprise.",
    },
    {
      title: "Accompagnement",
      description: "À renseigner avec une prestation réellement proposée par l'entreprise.",
    },
  ] satisfies Service[],

  approach: {
    title: "Une approche construite autour de votre besoin",
    description:
      "Présenter ici la méthode réelle de l'entreprise sans inventer de processus, délai ou garantie.",
    steps: [
      "Compréhension de la demande",
      "Proposition adaptée",
      "Exécution et suivi",
    ],
  },

  proofPoints: [] as ProofPoint[],

  contact: {
    email: "",
    phone: "",
    phoneLabel: "",
    address: "",
    primaryLabel: "Demander un échange",
  },

  theme: {
    accent: "#6D4AFF",
    accentSoft: "#9A82FF",
  },

  legal: {
    publisher: "",
    legalForm: "",
    registration: "",
    registeredOffice: "",
    publicationDirector: "",
    host: "Cloudflare, Inc.",
  },
} as const;
