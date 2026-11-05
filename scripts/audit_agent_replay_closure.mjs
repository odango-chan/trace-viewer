/**
 * Read-only audit of EXISTING ca-agent material-detail archives.
 *
 * This is not a canonical trajectory schema or a replay engine.
 * No user/system/model/tool text, IDs, refs, digests, or reasoning_content
 * may be emitted in audit reports or console logs.
 *
 * CLI use (run only in an authorized workspace):
 *   node scripts/audit_agent_replay_closure.mjs /path/to/material-detail.json
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sha = x => typeof x === 'string' && /^sha256:[0-9a-f]{64}$/.test(x)
const object = x => !!x && typeof x === 'object' && !Array.isArray(x)
const nonEmpty = x => typeof x === 'string' && x.length > 0
const snapshot = x => object(x) && Array.isArray(x.messages) &&
  x.messages.length > 0 &&
  x.messages.every(msg => object(msg) && nonEmpty(msg.role) && typeof msg.content === 'string')
const response = x => object(x) && Array.isArray(x.choices) && x.choices.length > 0
const results = (values, predicate) => Array.isArray(values) && values.some(predicate)

export function auditAgentReplayClosure(source) {
  if (!object(source) || !object(source.material) ||
      !Array.isArray(source.material.modelInteractions) ||
      !Array.isArray(source.material.toolCalls)) {
    throw new TypeError('Unsupported agent material archive')
  }
  const material = source.material
  const interactions = material.modelInteractions
  const tools = material.toolCalls
  const pairChecks = []

  for (let i = 0; i < interactions.length - 1; i++) {
    const first = interactions[i]
    const next = interactions[i + 1]
    if (!object(first) || !object(next)) continue
    const selected = first.selectedToolCallRequestRefs
    const sources = next.toolResultSourceRequestRefs
    for (const call of tools) {
      if (!object(call) || !nonEmpty(call.requestId) ||
          !results(selected, ref => ref === call.requestId)) continue
      const nextSourceExact = results(sources, ref => ref === call.requestId)
      const nextMessages = snapshot(next.requestSnapshot)
        ? next.requestSnapshot.messages.map(msg => msg.content).join('\n')
        : ''
      // This proves actual snapshot contents include the serialized result in
      // this captured profile, not that a separate DSH delivery event exists.
      const exactResultBodyIncluded = object(call.result) &&
        nextMessages.includes(JSON.stringify(call.result))
      pairChecks.push({
        selectedCallRefExact: true,
        nextModelResultSourceRefExact: nextSourceExact,
        nextModelInputContainsToolResultJson: exactResultBodyIncluded,
        toolArgumentsRetained: object(call.arguments),
        toolResultRetained: object(call.result),
      })
    }
  }

  const requestSnapshots = interactions.every(row => object(row) && snapshot(row.requestSnapshot))
  const responseSnapshots = interactions.every(row => object(row) && response(row.responseSnapshot))
  const requestDigestReferences = interactions.every(row => sha(row?.requestDigest))
  const responseDigestReferences = interactions.every(row => sha(row?.responseDigest))
  const frozenModelProfileRef = nonEmpty(material.modelProfileRef) && sha(material.modelProfileDigest)
  const toolSurfaceRef = nonEmpty(material.toolSurfaceRef) && sha(material.toolSurfaceDigest)
  const toolCatalogInline = interactions.every(row =>
    Array.isArray(row?.requestSnapshot?.tools) ||
    Array.isArray(row?.requestSnapshot?.functions))
  const sourceHasFrozenSkill = nonEmpty(material.loadedSkillContextRef) ||
    object(material.loadedSkillContext) || object(material.skillContextMaterial)
  const exactLinks = pairChecks.length > 0 && pairChecks.every(row =>
    row.nextModelResultSourceRefExact &&
    row.nextModelInputContainsToolResultJson &&
    row.toolArgumentsRetained && row.toolResultRetained)
  const hasReasoningField = interactions.some(row =>
    row?.responseSnapshot?.choices?.some(choice =>
      typeof choice?.message?.reasoning_content === 'string' &&
      choice.message.reasoning_content.length > 0))
  const perInteractionSourceRefs = interactions.every(row =>
    nonEmpty(row?.requestRef) && nonEmpty(row?.responseRef))

  // Security-by-construction: result contains only predefined booleans,
  // counts and constant status strings, no source text, refs or digests.
  return {
    sourceType: 'ARCHIVED_CA_AGENT_MATERIAL',
    testClassification: 'OWNER_RECORDED_NOT_SYNTHETIC',
    interactionCount: interactions.length,
    toolCallCount: tools.length,
    adjacentToolHandoffCount: pairChecks.length,
    checks: {
      requestSnapshots,
      responseSnapshots,
      perInteractionSourceRefs,
      requestDigestReferences,
      responseDigestReferences,
      toolSelectionAndNextInputExact: exactLinks,
      modelProfileRefAndDigest: frozenModelProfileRef,
      toolSurfaceRefAndDigest: toolSurfaceRef,
      toolCatalogBodyInRequestSnapshot: toolCatalogInline,
      frozenSkillContextInThisArchive: sourceHasFrozenSkill,
      restrictedReasoningFieldPresent: hasReasoningField,
    },
    replay: {
      historicalMessages: requestSnapshots ? 'PRESENT_UNVERIFIED_DIGEST' : 'MISSING',
      toolResultInFollowupModelInput: exactLinks ? 'EXACT_BODY_AND_REF' : 'NOT_PROVEN',
      toolCatalog: toolCatalogInline ? 'IN_REQUEST_SNAPSHOT' :
        toolSurfaceRef ? 'REF_ONLY_BODY_NOT_RETAINED_HERE' : 'UNAVAILABLE',
      skillContext: sourceHasFrozenSkill ? 'REFERENCE_OR_MATERIAL_PRESENT' : 'NOT_RETAINED_HERE',
      snapshotDigestProof: 'NOT_VERIFIED_WITH_OWNER_DIGEST_PROFILE',
      fullModelVisibleL0: 'PARTIAL',
      isolatedModelRerunL1: 'NOT_RUN',
      isolatedToolReplayL2: 'NOT_RUN',
      trainingEligibility: 'NOT_QUALIFIED_INDEPENDENT_EVALUATION_MISSING',
    },
    acceptance: exactLinks && requestSnapshots && responseSnapshots &&
      perInteractionSourceRefs ? 'PARTIAL_REPLAY_CLOSURE_PROVEN' : 'INCOMPLETE',
  }
}

function auditFile(path) {
  // Never include parsing failures with source bytes in console output.
  const data = JSON.parse(readFileSync(resolve(path), 'utf8'))
  return auditAgentReplayClosure(data)
}

const entrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (entrypoint) {
  try {
    if (process.argv.length !== 3) throw new Error('expected one private material-detail path')
    const report = auditFile(process.argv[2])
    console.log('AGENT_REPLAY_AUDIT ' + JSON.stringify(report))
    if (report.acceptance !== 'PARTIAL_REPLAY_CLOSURE_PROVEN') process.exitCode = 1
  } catch {
    console.error('AGENT_REPLAY_AUDIT_FAILED: invalid or incomplete source archive')
    process.exitCode = 1
  }
}
