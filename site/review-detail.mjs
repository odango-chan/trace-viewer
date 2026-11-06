/**
 * Deliberately narrow, on-demand local detail preview for UNVERSIONED review JSONL.
 * Not a TraceStore reader, not an owner-verified evidence extractor.
 *
 * The importer's presentation model never retains diagnostic payload. Only the
 * user-selected local File is reread after an explicit Inspector click.
 * No summary/diag/material object, raw payload or arbitrary key is returned.
 */
import { DiagnosticImportError } from './review-diagnostic.mjs'

const MAX_BYTES = 4 * 1024 * 1024
const MAX_ROWS = 10000
const MAX_FIELD_CHARS = 240

const FIELDS = Object.freeze({
  PREDICATE_EVALUATED: [
    ['predicate_identity', 'Predicate identity'],
    ['verdict', 'Verdict'],
    ['reason', 'Reason'],
  ],
  VERIFY_RESULT: [
    ['scope', 'Verification scope'],
    ['predicate', 'Predicate'],
    ['verdict', 'Verdict'],
    ['reason', 'Reason'],
  ],
  CALL_RESULT: [
    ['operation', 'Operation'],
    ['reported_outcome', 'Reported outcome'],
    ['outcome', 'Outcome'],
  ],
  GRAPH_TRANSITION: [
    ['source_node_id', 'Source node'],
    ['selected_edge', 'Selected edge'],
    ['next_node', 'Next node'],
    ['transition_id', 'Transition'],
  ],
  PROCEDURE_TERMINAL: [
    ['procedure', 'Procedure'],
    ['terminal', 'Terminal'],
  ],
  SKILL_RESULT: [
    ['skill', 'Skill'],
    ['procedure', 'Procedure'],
    ['outcome', 'Outcome'],
  ],
})

const WITHHELD = '[WITHHELD — potentially sensitive or structured]'
const NOT_SCALAR = '[WITHHELD — not a scalar]'
const SAFE_CHARS = /^[a-zA-Z0-9 _.,:;()=+\/-]{1,240}$/
const SENSITIVE = /(?:supi|imsi|imei|msisdn|gpsi|subscriber|authorization|bearer|password|passwd|secret|token|api[_-]?key|cookie|session[_-]?key|private|identity[_-]?document|\b[a-f0-9]{32,}\b|\b\d{5,}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i

function safeScalar(value) {
  if (value === null) return '[NOT PROVIDED IN SOURCE]'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') {
    return Number.isFinite(value) && Math.abs(value) < 10000 ? String(value) : WITHHELD
  }
  if (typeof value !== 'string') return NOT_SCALAR
  const text = value.trim()
  if (!text || text.length > MAX_FIELD_CHARS || !SAFE_CHARS.test(text) || SENSITIVE.test(text)) return WITHHELD
  return text
}

export function reviewDetailAvailable(kind) {
  return Object.hasOwn(FIELDS, kind)
}

export async function readLocalReviewDetail(file, sourceLine, expectedKind) {
  if (!file || typeof file.text !== 'function' || !Number.isSafeInteger(file.size) ||
      file.size <= 0 || file.size > MAX_BYTES || !Number.isSafeInteger(sourceLine) ||
      sourceLine < 1 || sourceLine > MAX_ROWS || !reviewDetailAvailable(expectedKind)) {
    throw new DiagnosticImportError('DETAIL_UNAVAILABLE', 'Local detail source or selection is not supported')
  }
  // Only reread the same user-provided File object held by the browser; no fetch.
  const content = await file.text()
  if (typeof content !== 'string' || content.length > MAX_BYTES || !content.endsWith('\n')) {
    throw new DiagnosticImportError('DETAIL_UNAVAILABLE', 'Local diagnostic export is incomplete')
  }
  const rows = content.split('\n')
  rows.pop()
  if (rows.length < sourceLine || rows.length > MAX_ROWS) {
    throw new DiagnosticImportError('DETAIL_UNAVAILABLE', 'Selected source line is outside the export')
  }
  let source
  try {
    source = JSON.parse(rows[sourceLine - 1])
  } catch {
    throw new DiagnosticImportError('DETAIL_UNAVAILABLE', 'Selected diagnostic line cannot be parsed')
  }
  if (!source || Array.isArray(source) || typeof source !== 'object' ||
      source.kind !== expectedKind || !source.data || Array.isArray(source.data) ||
      typeof source.data !== 'object') {
    throw new DiagnosticImportError('DETAIL_UNAVAILABLE', 'Selected diagnostic kind changed or is unsupported')
  }
  const fields = []
  for (const [key, label] of FIELDS[expectedKind]) {
    if (!Object.hasOwn(source.data, key)) continue
    fields.push({label, value:safeScalar(source.data[key])})
  }
  const evidence = source.data.evidence_refs
  const evidenceRefCount = Array.isArray(evidence) && evidence.length <= 256 ? evidence.length : null
  // Explicitly report presence, not authenticity, of source material.
  const materialReported = source.material !== null && typeof source.material === 'object' && !Array.isArray(source.material)
  return {
    sourceLine,
    kind:expectedKind,
    fields,
    evidenceRefCount,
    materialReported,
    provenance:'UNVERSIONED_REVIEW_EXPORT',
    integrity:'NOT_VERIFIED',
  }
}
