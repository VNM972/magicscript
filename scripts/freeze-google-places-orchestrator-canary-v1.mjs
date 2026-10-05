/**
 * FREEZE GOOGLE PLACES ORCHESTRATOR CANARY V1 SAMPLE.
 *
 * Deterministic, LOCAL-ONLY selection of EXACTLY 3 REAL_COMMERCIAL prospects
 * from the local D1 prospect universe (._prospects.json snapshot).
 *
 * NO Google, NO Tavily, NO network, NO mutation of any canonical state.
 * This script ONLY reads the local snapshot and writes:
 *   bulk/reports/google-places-orchestrator-canary-v1-sample.json
 *
 * Selection deterministic rule (documents exact reasons):
 *   - Universe: local real-commercial prospects from ._prospects.json
 *   - Eligible gates (all must pass):
 *       * non-synthetic, non-E2E, non-smoke-fixture
 *       * non-SUNeLEK / non-internal
 *       * non-HUMAN_ACTION_REQUIRED (not human-blocked)
 *       * non-REJECT classification (commercialEligibility !== 'REJECT')
 *       * non-zero-score DISQUALIFIED are effectively REJECT -> excluded
 *   - Diversity target applied to the eligible set:
 *       A) weak/no current contact coverage  -> contactability.status MISSING, no website
 *       B) existing first-party verified contact -> contactability PUBLISHED_VERIFIED
 *       C) partial contact / website identity anchor present, no phone recorded
 *   - When the local data supports more than one prospect per category, pick the
 *     one with the HIGHEST score in its category (best real-commercial candidate),
 *     tie-break by prospectId ascending. This is deterministic and reproducible.
 *
 * Selected (final):
 *   A) L'UNIVERS DU PNEU  (weak contact: MISSING, no website, no phone)
 *   B) QUALICONSULT SECURITE (existing first-party PUBLISHED_VERIFIED email)
 *   C) SMAC               (partial: website identity anchor present, no phone)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const CANARY_VERSION = 'google-places-orchestrator-canary-v1';
const SAMPLE_REL = 'bulk/reports/google-places-orchestrator-canary-v1-sample.json';
const SNAPSHOT_REL = '._prospects.json';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Reject boolean-ish known exclusions from structured fields. */
function isExcluded(prospect) {
  const name = String(prospect.companyName ?? '');
  if (/SUNeLEK/i.test(name)) return true; // internal / known project
  if (/synthetic/i.test(name)) return true;
  if (/e2e/i.test(name)) return true;
  if (/smoke/i.test(name)) return true;
  if (/fixture/i.test(name)) return true;
  // Exclude prospects whose contact channels are synthetic-test fixtures,
  // even when their company name does not literally say "synthetic".
  const syntheticChannel = (prospect.contactability?.channels || []).some(
    (c) => c && (c.origin === 'synthetic-test' || c.sourceType === 'synthetic-test'),
  );
  if (syntheticChannel) return true;
  if (prospect.state === 'HUMAN_ACTION_REQUIRED') return true; // human-blocked
  return false;
}

function isRejectByScore(prospect) {
  const score = prospect.score;
  if (prospect.state === 'DISQUALIFIED' && (score === 0 || score === 'UNKNOWN' || score === undefined || score === null)) {
    return true; // zero-score DISQUALIFIED are REJECT-level
  }
  if (prospect.commercialEligibility === 'REJECT') return true;
  return false;
}

function eligibleProspects(prospects) {
  return prospects.filter((p) => p && !isExcluded(p) && !isRejectByScore(p));
}

/** Extract postal code from a location string. */
function postalOf(location) {
  const m = String(location ?? '').match(/\b(97\d{3})\b/);
  return m ? m[1] : null;
}

/** Locality for the orchestrator: prefer city, else last locality token of location. */
function localityOf(prospect) {
  if (prospect.city && String(prospect.city).trim()) return String(prospect.city).trim();
  const loc = String(prospect.location ?? '').trim();
  const tokens = loc.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) return tokens[tokens.length - 1];
  return loc || null;
}

export function buildSample(prospects, now = () => new Date().toISOString()) {
  // Deduplicate by prospectId before categorizing so a prospect never appears twice.
  const seen = new Set();
  const unique = prospects.filter((p) => {
    if (!p || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  const eligible = eligibleProspects(unique);

  // Category A: weak/no contact coverage (MISSING status, NO website).
  const catA = eligible.filter((p) => {
    const status = p.contactability?.status || 'MISSING';
    return status === 'MISSING' && !p.websiteUrl;
  });

  // Category B: existing first-party / trusted contact (PUBLISHED_VERIFIED).
  const catB = eligible.filter((p) => {
    const status = p.contactability?.status || '';
    return status === 'PUBLISHED_VERIFIED';
  });

  // Category C: partial contact / website identity anchor present, no phone recorded,
  // and NOT already selected as B.
  const catC = eligible.filter((p) => {
    if (catB.some((x) => x.id === p.id)) return false;
    const hasPhone = (p.contactability?.channels || []).some((c) => c && c.type === 'PHONE');
    return Boolean(p.websiteUrl) && !hasPhone;
  });

  const byScoreThenId = (a, b) =>
    (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id);

  const pick = (group) => [...group].sort(byScoreThenId)[0];

  const a = pick(catA);
  const b = pick(catB);
  const c = pick(catC);

  const selected = [a, b, c].filter(Boolean);
  if (selected.length !== 3 || new Set(selected.map((x) => x.id)).size !== 3) {
    throw new Error(`Cannot assemble 3 unique-prospect canary sample: got ${selected.length}`);
  }

  const reasons = {
    [a.id]: 'A) WEAK_OR_NO_CONTACT: contactability MISSING, no website, no phone recorded; highest-score eligible real commercial local business in this category.',
    [b.id]: 'B) EXISTING_FIRST_PARTY_CONTACT: PUBLISHED_VERIFIED first-party email contact exists for comparison; real commercial local business with official site.',
    [c.id]: 'C) PARTIAL_CONTACT_WEBSITE_ANCHOR: website identity anchor present, no phone recorded; real commercial local business for testing Google identity+branch binding.',
  };

  const prospectsOut = selected.map((p) => ({
    prospectId: p.id,
    canonicalName: p.companyName,
    classification: p.commercialEligibility || 'ELIGIBLE',
    eligibility: {
      realCommercial: true,
      internal: false,
      synthetic: false,
      technicalTest: false,
      excluded: false,
      humanBlocked: p.state === 'HUMAN_ACTION_REQUIRED',
      contactDiscoveryEligible: true,
      state: p.state,
      score: p.score,
      commercialEligibility: p.commercialEligibility || 'ELIGIBLE',
      evidence: [
        'REAL_COMMERCIAL_PROSPECT',
        'NOT_INTERNAL',
        'NOT_SYNTHETIC',
        'NOT_TECHNICAL_TEST',
        'NOT_EXCLUDED',
        'NOT_HUMAN_BLOCKED',
        'CONTACT_DISCOVERY_ELIGIBLE',
      ],
    },
    selectionReason: reasons[p.id],
    knownContactSummary: {
      contactabilityStatus: p.contactability?.status || 'MISSING',
      channelCount: (p.contactability?.channels || []).length,
      hasPhone: (p.contactability?.channels || []).some((c) => c && c.type === 'PHONE') || false,
      hasEmail: (p.contactability?.channels || []).some((c) => c && c.type === 'EMAIL') || false,
      websiteUrl: p.websiteUrl || null,
    },
    humanBlockStatus: p.state === 'HUMAN_ACTION_REQUIRED' ? 'HUMAN_ACTION_REQUIRED' : 'NOT_BLOCKED',
    orchestratorIdentityFields: {
      canonicalLocality: localityOf(p),
      canonicalAddress: p.location || null,
      canonicalPostalCode: postalOf(p.location),
      canonicalWebsite: p.websiteUrl || null,
    },
  }));

  const wrapper = {
    canaryVersion: CANARY_VERSION,
    createdAt: now(),
    maxGoogleRequests: 3,
    maxRequestsPerProspect: 1,
    sample: prospectsOut,
  };

  const canonicalCanaryHash = sha256(JSON.stringify(wrapper.sample));
  return { ...wrapper, canonicalCanaryHash };
}

async function main() {
  const raw = await fs.readFile(path.join(root, SNAPSHOT_REL), 'utf8');
  const data = JSON.parse(raw);
  const prospects = Array.isArray(data) ? data : data.prospects || [];
  const sample = buildSample(prospects);
  await fs.writeFile(path.join(root, SAMPLE_REL), JSON.stringify(sample, null, 2) + '\n', 'utf8');
  console.log('Canary sample frozen.');
  console.log('canonicalCanaryHash:', sample.canonicalCanaryHash);
  console.log('prospects:', sample.sample.map((p) => p.canonicalName).join(', '));
  return sample;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
    .then(() => {})
    .catch((e) => {
      console.error('Freeze failed:', e.message);
      process.exitCode = 1;
    });
}
