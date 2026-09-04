export type SasRecordStatus = 'RAW' | 'SAS_PENDING' | 'VALIDATED' | 'BLOCKED' | 'UNKNOWN';
export type SasConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface SasEvidence {
  url?: string;
  checkedAt: string;
  confidence: SasConfidence;
  note?: string;
}

export interface SasField {
  value: string | null;
  evidence: readonly SasEvidence[];
  confidence: SasConfidence;
}

export interface ProspectSasRecord {
  id: string;
  companyName: string;
  status: SasRecordStatus;
  fields: Readonly<Record<string, SasField>>;
  contactAllowed: false;
  commercialActivation: 'DISABLED';
  humanReviewRequired: true;
  createdAt: string;
  updatedAt: string;
}

export interface SasValidation {
  accepted: boolean;
  reasons: readonly string[];
}

const STATUSES: readonly SasRecordStatus[] = ['RAW', 'SAS_PENDING', 'VALIDATED', 'BLOCKED', 'UNKNOWN'];
const CONFIDENCES: readonly SasConfidence[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createSasPendingRecord(
  id: string,
  companyName: string,
  timestamp: string,
): ProspectSasRecord {
  return {
    id,
    companyName,
    status: 'SAS_PENDING',
    fields: {},
    contactAllowed: false,
    commercialActivation: 'DISABLED',
    humanReviewRequired: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateSasRecord(record: Partial<ProspectSasRecord>): SasValidation {
  const reasons: string[] = [];
  if (!hasText(record.id)) reasons.push('SAS id is required');
  if (!hasText(record.companyName)) reasons.push('company name is required');
  if (!STATUSES.includes(record.status as SasRecordStatus)) reasons.push('SAS status is invalid');
  if (!record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields)) {
    reasons.push('SAS fields object is required');
  } else {
    Object.entries(record.fields).forEach(([fieldName, field]) => {
      if (!hasText(fieldName)) reasons.push('SAS field name is required');
      if (!field || !CONFIDENCES.includes(field.confidence)) reasons.push(`field ${fieldName} confidence is invalid`);
      if (!Array.isArray(field?.evidence)) {
        reasons.push(`field ${fieldName} evidence must be an array`);
      } else {
        field.evidence.forEach((evidence, index) => {
          if (!hasText(evidence?.checkedAt)) reasons.push(`field ${fieldName} evidence ${index + 1} date is required`);
          if (!CONFIDENCES.includes(evidence?.confidence)) reasons.push(`field ${fieldName} evidence ${index + 1} confidence is invalid`);
          if (evidence?.url !== undefined && (!hasText(evidence.url) || !isHttpUrl(evidence.url))) {
            reasons.push(`field ${fieldName} evidence ${index + 1} URL is invalid`);
          }
        });
      }
      if (field?.value !== null && field?.value !== undefined && !hasText(field.value)) {
        reasons.push(`field ${fieldName} value must be text or null`);
      }
      if (field?.value !== null && field?.value !== undefined && (field?.evidence?.length ?? 0) === 0) {
        reasons.push(`field ${fieldName} needs evidence when populated`);
      }
    });
  }
  if (record.contactAllowed !== false) reasons.push('SAS contact must remain disabled');
  if (record.commercialActivation !== 'DISABLED') reasons.push('commercial activation must remain disabled');
  if (record.humanReviewRequired !== true) reasons.push('human review is required');
  if (!hasText(record.createdAt) || !hasText(record.updatedAt)) reasons.push('SAS timestamps are required');

  return { accepted: reasons.length === 0, reasons };
}

export function canPromoteSasRecord(
  record: ProspectSasRecord,
  humanApproved: boolean,
): boolean {
  if (!humanApproved || record.status !== 'VALIDATED') return false;
  if (!validateSasRecord(record).accepted) return false;

  return Object.values(record.fields).every(
    (field) => field.value !== null && field.confidence !== 'UNKNOWN',
  );
}
