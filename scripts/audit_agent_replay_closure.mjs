/**
 * Source-specific, READ-ONLY audit for ca-agent ProductTask Model→Tool→Model archives.
 * Does not emit messages, prompt text, model reasoning, tool input/results,
 * refs, hashes or other Owner material. Not a general-purpose Trace contract.
 *
 * Exact serialization checks use the archived JSON objects and documented
 * Go producer behavior, and fail closed to NOT_VERIFIED on incompatibility.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sha = x => typeof x === 'string' && /^sha256:[0-9a-f]{64}$/.test(x)
const digest = x => 'sha256:' + createHash('sha256').update(x, 'utf8').digest('hex')
const object = x => !!x && typeof x === 'object' && !Array.isArray(x)
const nonEmpty = x => typeof x === 'string' && x.length > 0
const snapshot = x => object(x) && Array.isArray(x.messages) &&
  x.messages.length > 0 &&
  x.messages.every(msg => object(msg) && nonEmpty(msg.role) && typeof msg.content === 'string')
const response = x => object(x) && Array.isArray(x.choices) && x.choices.length > 0
const results = (values, predicate) => Array.isArray(values) && values.some(predicate)

function checkDigest(value, expected) {
  // The snapshots originate as json.RawMessage from Go. Archive JSON may
  // reserialize; therefore MATCH proves parity for this capture, while
  // MISMATCH only says the available representation cannot prove raw bytes.
  if (!object(value) || !sha(expected)) return 'NOT_VERIFIED'
  return digest(JSON.stringify(value)) === expected ? 'MATCH' : 'NOT_VERIFIED'
}

/** Strict owner-specific prompt assembly: DecideProductTask appends " Input: {…}". */
function effectiveProductTaskInput(snapshotValue) {
  if (!snapshot(snapshotValue)) return null
  const user = snapshotValue.messages.filter(msg => msg.role === 'user').at(-1)
  if (!user || user.content.length > 250000) return null
  const pos = user.content.lastIndexOf(' Input: ')
  if (pos < 0) return null
  const raw = user.content.slice(pos + ' Input: '.length)
  if (!raw.startsWith('{') || !raw.endsWith('}')) return null
  try {
    const parsed = JSON.parse(raw)
    if (!object(parsed) || !Array.isArray(parsed.tools) || !('observation' in parsed) ||
        !nonEmpty(parsed.intent)) return null
    if (!parsed.tools.every(t => object(t) && nonEmpty(t.Name) &&
      typeof t.Description === 'string' &&
      (t.InputSchema === undefined || object(t.InputSchema)))) return null
    return parsed
  } catch { return null }
}

function canonicalToolSurface(input) {
  if (!input || !Array.isArray(input.tools)) return null
  const surface = input.tools.map(t => ({
    name: t.Name, description: t.Description,
    ...(t.InputSchema === undefined || Object.keys(t.InputSchema).length === 0
      ? {} : { inputSchema: t.InputSchema }),
  }))
  return JSON.stringify(surface)
}

export function auditAgentReplayClosure(source) {
  if (!object(source) || !object(source.material) ||
      !Array.isArray(source.material.modelInteractions) ||
      !Array.isArray(source.material.toolCalls)) {
    throw new TypeError('Unsupported agent material archive')
  }
  const material = source.material
  const interactions = material.modelInteractions
  const tools = material.toolCalls
  const inputs = interactions.map(row => effectiveProductTaskInput(row?.requestSnapshot))
  const productTaskProfileConfirmed = inputs.length > 0 && inputs.every(Boolean)
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
      const exactResultBodyIncluded = object(call.result) &&
        nextMessages.includes(JSON.stringify(call.result))
      const input = inputs[i], nextInput = inputs[i + 1]
      // A strictly in-memory ToolResult stub: no tool dispatch, no model call,
      // no external effects. Verify the next input's observation equals the
      // actual archived result and the admitted tool was in the prior surface.
      const observationStubExact = !!(input && nextInput && object(call.result) &&
        JSON.stringify(nextInput.observation) === JSON.stringify(call.result) &&
        JSON.stringify(nextInput.tools) === JSON.stringify(input.tools) &&
        nextInput.intent === input.intent &&
        input.observation === null)
      pairChecks.push({
        selectedCallRefExact: true,
        nextModelResultSourceRefExact: nextSourceExact,
        nextModelInputContainsToolResultJson: exactResultBodyIncluded,
        toolArgumentsRetained: object(call.arguments),
        toolResultRetained: object(call.result),
        selectedToolInVisibleCatalog: !!input && input.tools.some(item => item.Name === call.toolName),
        inMemoryObservationStubMatchesNextModelInput: observationStubExact,
      })
    }
  }

  const requestSnapshots = interactions.length > 0 && interactions.every(row =>
    object(row) && snapshot(row.requestSnapshot))
  const responseSnapshots = interactions.length > 0 && interactions.every(row =>
    object(row) && response(row.responseSnapshot))
  const requestDigestReferences = interactions.every(row => sha(row?.requestDigest))
  const responseDigestReferences = interactions.every(row => sha(row?.responseDigest))
  const requestDigestMatches = requestSnapshots && interactions.every(row =>
    checkDigest(row.requestSnapshot, row.requestDigest) === 'MATCH')
  const responseDigestMatches = responseSnapshots && interactions.every(row =>
    checkDigest(row.responseSnapshot, row.responseDigest) === 'MATCH')
  const frozenModelProfileRef = nonEmpty(material.modelProfileRef) && sha(material.modelProfileDigest)
  const toolSurfaceRef = nonEmpty(material.toolSurfaceRef) && sha(material.toolSurfaceDigest)
  const toolCatalogInline = interactions.every(row =>
    Array.isArray(row?.requestSnapshot?.tools) ||
    Array.isArray(row?.requestSnapshot?.functions))
  const catalogDigestMatches = productTaskProfileConfirmed && toolSurfaceRef &&
    inputs.every(input => digest(canonicalToolSurface(input)) === material.toolSurfaceDigest)
  const sourceHasFrozenSkill = nonEmpty(material.loadedSkillContextRef) ||
    object(material.loadedSkillContext) || object(material.skillContextMaterial)
  const exactLinks = pairChecks.length > 0 && pairChecks.every(row =>
    row.nextModelResultSourceRefExact &&
    row.nextModelInputContainsToolResultJson &&
    row.toolArgumentsRetained && row.toolResultRetained)
  const stubExact = pairChecks.length > 0 && pairChecks.every(row =>
    row.inMemoryObservationStubMatchesNextModelInput && row.selectedToolInVisibleCatalog)
  const hasReasoningField = interactions.some(row =>
    row?.responseSnapshot?.choices?.some(choice =>
      typeof choice?.message?.reasoning_content === 'string' &&
      choice.message.reasoning_content.length > 0))
  const perInteractionSourceRefs = interactions.every(row =>
    nonEmpty(row?.requestRef) && nonEmpty(row?.responseRef))

  // SECURITY: only immutable status strings, booleans and counts leave this function.
  return {
    sourceType: 'ARCHIVED_CA_AGENT_MATERIAL',
    testClassification: 'OWNER_RECORDED_NOT_SYNTHETIC',
    interactionCount: interactions.length,
    toolCallCount: tools.length,
    adjacentToolHandoffCount: pairChecks.length,
    checks: {
      requestSnapshots, responseSnapshots, perInteractionSourceRefs,
      requestDigestReferences, responseDigestReferences,
      requestDigestMatchesArchivedJson: requestDigestMatches,
      responseDigestMatchesArchivedJson: responseDigestMatches,
      toolSelectionAndNextInputExact: exactLinks,
      modelProfileRefAndDigest: frozenModelProfileRef,
      toolSurfaceRefAndDigest: toolSurfaceRef,
      toolCatalogBodyInTopLevelRequest: toolCatalogInline,
      productTaskPromptToolCatalogExtractable: productTaskProfileConfirmed,
      toolCatalogDigestMatchesOwnerSurface: !!catalogDigestMatches,
      toolResultStubObservationMatchesNextInput: stubExact,
      frozenSkillContextInThisArchive: sourceHasFrozenSkill,
      restrictedReasoningFieldPresent: hasReasoningField,
    },
    replay: {
      historicalMessages: requestDigestMatches ? 'ARCHIVED_JSON_DIGEST_MATCH' : requestSnapshots ? 'PRESENT_DIGEST_NOT_VERIFIED' : 'MISSING',
      toolResultInFollowupModelInput: exactLinks ? 'EXACT_BODY_AND_REF' : 'NOT_PROVEN',
      toolCatalog: catalogDigestMatches ? 'IN_MODEL_PROMPT_DIGEST_MATCH' :
        productTaskProfileConfirmed ? 'IN_MODEL_PROMPT_DIGEST_NOT_VERIFIED' :
        toolSurfaceRef ? 'REF_ONLY_BODY_NOT_RETAINED_HERE' : 'UNAVAILABLE',
      skillContext: productTaskProfileConfirmed ? 'NOT_APPLICABLE_PRODUCTTASK_DECISION' :
        sourceHasFrozenSkill ? 'REFERENCE_OR_MATERIAL_PRESENT' : 'NOT_PROVEN',
      snapshotDigestProof: requestDigestMatches && responseDigestMatches ?
        'ARCHIVED_JSON_REQUEST_RESPONSE_MATCH' : 'NOT_VERIFIED',
      fullModelVisibleL0: 'PARTIAL',
      isolatedModelRerunL1: 'NOT_RUN',
      isolatedToolReplayL2: stubExact ? 'OBSERVATION_STUB_ONLY_NO_CONTROL_FLOW_REPLAY' : 'NOT_RUN',
      trainingEligibility: 'NOT_QUALIFIED_INDEPENDENT_EVALUATION_MISSING',
    },
    acceptance: exactLinks && requestSnapshots && responseSnapshots &&
      perInteractionSourceRefs ? 'PARTIAL_REPLAY_CLOSURE_PROVEN' : 'INCOMPLETE',
  }
}

const entrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (entrypoint) {
  try {
    if (process.argv.length !== 3) throw new Error('expected one private material-detail path')
    const data = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'))
    const report = auditAgentReplayClosure(data)
    console.log('AGENT_REPLAY_AUDIT ' + JSON.stringify(report))
    if (report.acceptance !== 'PARTIAL_REPLAY_CLOSURE_PROVEN') process.exitCode = 1
  } catch {
    console.error('AGENT_REPLAY_AUDIT_FAILED: invalid or incomplete source archive')
    process.exitCode = 1
  }
}
