/**
 * Console-inspired READ-TIME presentation only.
 * Explicit source refs are the only allowable pairing evidence.
 * This never writes synthetic or derived events into an owner source.
 */
export const VIEW_MODES = Object.freeze(['readable', 'model', 'owners', 'raw'])
export const LANES = Object.freeze([
  { id: 'agent', label: 'Agent / Model' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'fabric', label: 'Service Fabric' },
  { id: 'world', label: 'World / Environment' },
])

export function laneOf(record) {
  const authority = String(record.sourceAuthority || '').toLowerCase()
  if (authority.includes('agent') || authority.includes('host')) return 'agent'
  if (authority.includes('runtime')) return 'runtime'
  if (authority.includes('fabric') || authority.includes('provider')) return 'fabric'
  return 'world'
}

function pairByExactRef(records, start, resultKind, seen) {
  const matches = records.filter(other =>
    other.kind === resultKind && other.ref !== start.ref &&
    other.sourceAuthority === start.sourceAuthority &&
    Array.isArray(other.causalRefs) && other.causalRefs.includes(start.ref))
  // Ambiguous matches are deliberately not combined.
  if (matches.length !== 1) return null
  const result = matches[0]
  if (seen.has(result.ref)) return null
  return result
}

export function projectSectionRows(run, section, mode = 'readable') {
  if (!VIEW_MODES.includes(mode)) throw new Error('Unknown presentation mode')
  const records = run.sections.flatMap(item => item.records)
  const hidden = new Set()
  const rows = []
  // For source-oriented modes, do not fold or reorder source records.
  const selected = (mode === 'model')
    ? section.records.filter(item =>
        laneOf(item) === 'agent' && (
          String(item.sourceAuthority).includes('agent') ||
          item.kind.startsWith('MODEL_') || item.kind.startsWith('TOOL_')
        ))
    : section.records
  const fold = mode === 'readable' || mode === 'model'
  if (fold) {
    // Folding can point to a result outside this section. That result stays
    // in its own section so the Runtime/Delivery boundary remains legible.
    const localRefs = new Set(section.records.map(item => item.ref))
    for (const candidate of selected) {
      const targetKind = candidate.kind === 'MODEL_REQUEST' ? 'MODEL_RESPONSE'
                       : candidate.kind === 'TOOL_CALL' ? 'TOOL_RESULT'
                       : null
      if (!targetKind) continue
      const result = pairByExactRef(records, candidate, targetKind, hidden)
      if (result && localRefs.has(result.ref)) hidden.add(result.ref)
    }
  }
  for (const record of selected) {
    if (hidden.has(record.ref)) continue
    let members = [record]
    let label = record.kind.replaceAll('_', ' ')
    if (fold) {
      const resultKind = record.kind === 'MODEL_REQUEST' ? 'MODEL_RESPONSE'
                       : record.kind === 'TOOL_CALL' ? 'TOOL_RESULT' : null
      if (resultKind) {
        const result = pairByExactRef(records, record, resultKind, new Set())
        if (result) {
          members = [record, result]
          label = record.kind === 'MODEL_REQUEST' ? 'Model Interaction' : 'Tool Interaction'
        } else if (record.kind === 'MODEL_REQUEST') label = 'Model Request · response unavailable'
        else label = 'Tool Call · result unavailable'
      }
    }
    rows.push({
      key: record.ref, source: record, members, label,
      lane: laneOf(record), isFolded: members.length > 1,
    })
  }
  return rows
}

export function projectLanes(rows) {
  return LANES.map(lane => ({
    ...lane, rows: rows.filter(row => row.lane === lane.id),
  }))
}

export function findPrimaryUnknown(run) {
  const records = run.sections.flatMap(item => item.records)
  return records.find(item => item.status === 'OUTCOME_UNKNOWN')
      ?? records.find(item => item.status === 'RESULT_UNKNOWN')
      ?? records.find(item => ['UNRESOLVED', 'FAILED', 'BLOCKED'].includes(item.status))
      ?? null
}
