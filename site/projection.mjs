/**
 * D0 synthetic-only presentation utilities.
 * No producer contract, owner truth, or implicit cross-owner join lives here.
 */
export const EXCEPTION_STATUSES = Object.freeze(new Set(['FAILED', 'UNRESOLVED', 'OUTCOME_UNKNOWN', 'RESULT_UNKNOWN', 'BLOCKED', 'DENIED', 'SAFE_STOPPED']))

export function validateSyntheticRun(run) {
  if (!run || run.sourceKind !== 'SYNTHETIC') {
    throw new Error('Only explicitly synthetic D0 fixtures are supported')
  }
  return validatePresentationRun(run)
}

export function validatePresentationRun(run) {
  if (!run || !['SYNTHETIC','NATIVE_LOCAL'].includes(run.sourceKind) || !Array.isArray(run.sections)) {
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
      if (!record.ref || !record.sourceAuthority || !Number.isSafeInteger(record.ownerSequence) || record.ownerSequence < 0) {
        throw new Error('Record must have exact ref, owner authority, and owner-local sequence')
      }
      if (ids.has(record.ref)) throw new Error('Repeated record ref')
      ids.add(record.ref)
      const key = record.sourceAuthority + ':' + record.ownerSequence
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
