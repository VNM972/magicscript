import { strict as assert } from 'node:assert';
import test from 'node:test';
import { canonicalizationFromPresence, extractionFromPresence, normalizeFailureReason, pathOriginFor, sourceTelemetryId } from '../contact-acquisition/telemetry';

test('NOT_ATTEMPTED_NOT_FAILED',()=>assert.equal(normalizeFailureReason(null),null));
test('FAILURE_REASON_NORMALIZED',()=>assert.equal(normalizeFailureReason('HTTP_STATUS_403'),'HTTP_403'));
test('SOURCE_ID_STABLE',()=>assert.equal(sourceTelemetryId('p','https://example.fr'),sourceTelemetryId('p','https://example.fr')));
test('GENERATED_PATH_DISTINCT_FROM_FETCHED_PATH',()=>assert.equal(pathOriginFor('owned-site-exploration','CONTACT_PAGE'),'GENERATED_CONTACT_PATH'));
test('EXTRACTION_EVIDENCE_LINKED_TO_SOURCE',()=>assert.equal(extractionFromPresence({phone:{evidence:[{evidenceType:'TEL_HREF'}]},email:{evidence:[]}}).phoneEvidenceTypes[0],'TEL_HREF'));
test('CANONICALIZATION_LINKED_TO_SOURCE',()=>assert.equal(canonicalizationFromPresence({phone:{status:'VERIFIED'},reasons:['identity bound']}).phoneVerified,true));
