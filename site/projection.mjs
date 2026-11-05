/**
 * D0 synthetic-only presentation utilities.
 * No producer contract, owner truth, or implicit cross-owner join lives here.
 */
export const EXCEPTION_STATUSES = Object.freeze(new Set(['FAIL', 'UNKNOWN', 'FAILED', 'UNRESOLVED', 'OUTCOME_UNKNOWN', 'RESULT_UNKNOWN', 'BLOCKED', 'DENIED', 'SAFE_STOPPED']))

export function validateSyntheticRun(run) {
  if (!run || run.sourceKind !== 'SYNTHETIC') {
    throw new Error('Only explicitly synthetic D0 fixtures are supported')
  }
  return validatePresentationRun(run)
}

export function validatePresentationRun(run) {
  if (!run || !['SYNTHETIC','NATIVE_LOCAL','REVIEW_DIAGNOSTIC'].includes(run.sourceKind) || !Array.isArray(run.sections)) {
    throw new Error('Only validated synthetic or local native presentation is supported')
  }
  const ids = new Set()
  const ownerSequences = new Set()
  const sections = new Set()
  for (const section of run.sections) {
    if (!section.id || sections.has(section.id) || !Array.isArray(section.records)) {
      throw new Error('Invalid or repeated presentation section')
    }
    sections.add(section.id)
    for (const record of section.records) {
      const isReview = run.sourceKind === 'REVIEW_DIAGNOSTIC'
      const validPosition = isReview
        ? record.ownerSequence === null && Number.isSafeInteger(record.sourceLine) && record.sourceLine >= 1
        : Number.isSafeInteger(record.ownerSequence) && record.ownerSequence >= 0
      if (!record.ref || !record.sourceAuthority || !validPosition) {
        throw new Error('Record must have exact ref, authority and native owner sequence or review-file line')
      }
      if (ids.has(record.ref)) throw new Error('Repeated record ref')
      ids.add(record.ref)
      const key = record.sourceAuthority + (run.sourceKind === 'REVIEW_DIAGNOSTIC'
        ? ':file-line=' + record.sourceLine : ':owner-seq=' + record.ownerSequence)
      if (ownerSequences.has(key)) throw new Error('Duplicate owner-local sequence')
      ownerSequences.add(key)
      if (record.causalRefs !== undefined && (!Array.isArray(record.causalRefs) || record.causalRefs.some(ref => typeof ref !== 'string'))) {
        throw new Error('Causal refs must be explicit strings')
      }
    }
  }
  return run
}

export function allRecords(run) {
  validatePresentationRun(run)
  return run.sections.flatMap(section => section.records)
}

export function getSourceLinks(run, record) {
  const byRef = new Map(allRecords(run).map(item => [item.ref, item]))
  return (record.causalRefs || []).map(ref => ({
    ref,
    target: byRef.get(ref) || null,
  }))
}

export function runSummary(run) {
  const records = allRecords(run)
  const statuses = records.filter(item => EXCEPTION_STATUSES.has(item.status))
  return {
    events: records.length,
    ownerStreams: new Set(records.map(item => item.sourceAuthority)).size,
    exceptions: statuses.length,
    missingCausalTargets: records.reduce((sum, item) => sum + getSourceLinks(run, item).filter(link => !link.target).length, 0),
  }
}

export function defaultOpenSections(run) {
  validatePresentationRun(run)
  return run.sections.filter(section => section.records.some(item => EXCEPTION_STATUSES.has(item.status))).map(section => section.id)
}

export function isException(record) {
  return EXCEPTION_STATUSES.has(record.status)
}

/**
 * Source-aware Inspector claim, deliberately not a material reader.
 * Labels describe what the current browser adapter actually verified;
 * they never elevate imported reports to owner-native evidence.
 */
export function inspectorEvidenceStatus(run, record) {
  if (!record) return {
    label: 'NO SOURCE SELECTED',
    detail: 'Select a source record to inspect its evidence availability.',
  }
  if (run.sourceKind === 'SYNTHETIC') return {
    label: 'ILLUSTRATION ONLY',
    detail: 'This is synthetic demo content, not actual owner evidence or material.',
  }
  if (run.sourceKind === 'REVIEW_DIAGNOSTIC') return {
    label: 'WITHHELD BY REVIEW READER',
    detail: 'The diagnostic JSONL reader intentionally removes raw data, diagnostic text and material. Their absence from this view is not proof they were absent in the source; owner identity, digests and completeness remain unverified.',
  }
  if (run.sourceKind === 'NATIVE_LOCAL' && record.materialRef) return {
    label: 'DIGEST CHECKED · BODY HIDDEN',
    detail: 'The local TraceStore v2 importer checked the referenced material file against its SHA-256 digest. The material body is not displayed; full upstream Owner Loader validation and evidence completeness have not been established.',
  }
  if (run.sourceKind === 'NATIVE_LOCAL') return {
    label: 'NO MATERIAL REF ON RECORD',
    detail: 'This native event does not carry a material_ref. Evidence may exist elsewhere; absence of an event-level reference does not prove that the run has no evidence.',
  }
  return {
    label: 'UNVERIFIED SOURCE',
    detail: 'Evidence provenance for this source is not established.',
  }
}

export function sourceOverviewLabel(run) {
  if (run.sourceKind === 'NATIVE_LOCAL') return 'Local TraceStore v2'
  if (run.sourceKind === 'REVIEW_DIAGNOSTIC') return 'Diagnostic review export'
  return run.mode === 'DETERMINISTIC' ? 'Deterministic' : 'Agent / Model'
}
