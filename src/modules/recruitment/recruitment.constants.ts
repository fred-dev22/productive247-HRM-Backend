// Constantes partagees du module Recrutement. Aucun circuit de validation
// (decision client du 05/09) : les jeux de statuts sont volontairement
// courts, et il n'y a pas d'etape "approuver / refuser" sur une offre ni
// une expression de besoin.

// ── Prefixes des codes de reference (RB-2026-00001, OF-2026-00001, ...) ──
export const REFERENCE_PREFIXES = {
  hiringRequest: 'RB', // expRession de Besoin
  jobOffer: 'OF', // OFfre
  application: 'CD', // CanDidature
  interview: 'EN', // ENtretien
  contract: 'CT', // ConTrat
  trial: 'PE', // Periode d'Essai
  talentPool: 'VT', // Vivier de Talents
} as const;

// ── Jeux de statuts ─────────────────────────────────────────────────────
export const HIRING_REQUEST_STATUSES = ['Draft', 'Open', 'Closed', 'Cancelled'] as const;
export const JOB_OFFER_STATUSES = ['Draft', 'Published', 'Closed'] as const;
export const APPLICATION_STATUSES = ['New', 'InReview', 'InterviewScheduled', 'Retained', 'Rejected'] as const;
export const APPLICATION_SOURCES = ['Offer', 'Spontaneous', 'Internal'] as const;
export const INTERVIEW_STATUSES = ['Scheduled', 'Done', 'Cancelled'] as const;
export const INTERVIEW_MODES = ['InPerson', 'VideoCall'] as const;
export const CONTRACT_STATUSES = ['Draft', 'Sent', 'Negotiating', 'Accepted', 'Refused', 'Cancelled'] as const;
export const TRIAL_STATUSES = ['OnTrial', 'Extended', 'Converted', 'Cancelled'] as const;
export const TALENT_POOL_STATUSES = ['Open', 'Closed'] as const;

// Statuts d'une candidature ou l'on peut encore modifier / supprimer.
export const APPLICATION_EDITABLE_STATUSES = ['New', 'InReview'];

// Duree par defaut d'une periode d'essai (mois) — appliquee a la creation
// automatique lorsqu'une proposition d'embauche est acceptee.
export const TRIAL_PERIOD_MONTHS = 2;

// Rendu client : "Galana" devient "HV" dans tout le module (retour reunion
// du 05/09). Applique aux libelles seedes (modeles de contrat) et a tout
// texte genere cote backend.
export const CLIENT_SHORT_NAME = 'HV';
