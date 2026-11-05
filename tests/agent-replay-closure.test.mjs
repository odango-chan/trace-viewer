import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { auditAgentReplayClosure } from '../scripts/audit_agent_replay_closure.mjs'

const digest = 'sha256:' + 'a'.repeat(64)
function example() {
  const result = { status: 'SUCCEEDED', content: 'private tool result not for export' }
  return {
    material: {
      modelProfileRef: 'model_profile_ref', modelProfileDigest: digest,
      toolSurfaceRef: 'tool_surface_ref', toolSurfaceDigest: digest,
      modelInteractions: [
        {
          requestRef: 'first', responseRef: 'first-result',
          requestDigest: digest, responseDigest: digest,
          requestSnapshot: { model: 'model-name', messages: [{role:'system',content:'private prompt'}, {role:'user',content:'private user goal'}] },
          responseSnapshot: { choices: [{ message: { content: 'private output', reasoning_content:'private reasoning' } }] },
          selectedToolCallRequestRefs: ['tool-request'],
        },
        {
          requestRef: 'second', responseRef: 'second-result',
          requestDigest: digest, responseDigest: digest,
          requestSnapshot: { model: 'model-name', messages: [{role:'system',content:'private prompt'}, {role:'user',content:'Result: '+JSON.stringify(result)}] },
          responseSnapshot: { choices: [{ message: {content:'private response'} }] },
          toolResultSourceRequestRefs: ['tool-request'],
        },
      ],
      toolCalls: [{ requestId:'tool-request', arguments:{secret:'private'}, result }],
    },
  }
}

test('explicit Tool → next Model exact text/ref closes PARTIAL replay path', () => {
  const report=auditAgentReplayClosure(example())
  assert.equal(report.acceptance,'PARTIAL_REPLAY_CLOSURE_PROVEN')
  assert.equal(report.replay.toolResultInFollowupModelInput,'EXACT_BODY_AND_REF')
  assert.equal(report.replay.toolCatalog,'REF_ONLY_BODY_NOT_RETAINED_HERE')
  assert.equal(report.replay.fullModelVisibleL0,'PARTIAL')
  assert.equal(report.replay.trainingEligibility,'NOT_QUALIFIED_INDEPENDENT_EVALUATION_MISSING')
})

test('no source ref or no actual ToolResult text means incomplete, never guessed from adjacency', () => {
  const x=example()
  x.material.modelInteractions[1].toolResultSourceRequestRefs=[]
  assert.equal(auditAgentReplayClosure(x).acceptance,'INCOMPLETE')
  x.material.modelInteractions[1].toolResultSourceRequestRefs=['tool-request']
  x.material.modelInteractions[1].requestSnapshot.messages[1].content='Summary only'
  assert.equal(auditAgentReplayClosure(x).acceptance,'INCOMPLETE')
})

test('audit result never copies original model prompt, response, tool material or reasoning field',()=>{
  const report=JSON.stringify(auditAgentReplayClosure(example()))
  for(const forbidden of ['private prompt','private reasoning','private tool result',
    'private response','private user goal','tool-request','tool_surface_ref'])
    assert.equal(report.includes(forbidden),false)
  assert.equal(JSON.parse(report).checks.restrictedReasoningFieldPresent,true)
})

test('invalid source is rejected without attempting to infer schema',()=>{
  assert.throws(()=>auditAgentReplayClosure(null),/Unsupported/)
  assert.throws(()=>auditAgentReplayClosure({material:{modelInteractions:null,toolCalls:null}}),/Unsupported/)
})

function sha(data) { return 'sha256:' + createHash('sha256').update(JSON.stringify(data)).digest('hex') }
function productTaskExample() {
  const x=example()
  const item={Name:'release',Description:'Safe mocked release',InputSchema:{type:'object',properties:{key:{type:'string'}}}}
  const intent='synthetic test only'
  const result=x.material.toolCalls[0].result
  x.material.toolCalls[0].toolName=item.Name
  const input=(observation)=>({
    intent,observation,tools:[item]
  })
  for(const [i,observation] of [null,result].entries()) {
    const request=x.material.modelInteractions[i].requestSnapshot
    request.messages[1].content='Synthetic ProductTask decision. Input: '+JSON.stringify(input(observation))
    x.material.modelInteractions[i].requestDigest=sha(request)
    x.material.modelInteractions[i].responseDigest=sha(x.material.modelInteractions[i].responseSnapshot)
  }
  const surface=[{name:item.Name,description:item.Description,inputSchema:item.InputSchema}]
  x.material.toolSurfaceDigest=sha(surface)
  return x
}

test('real ProductTask input is embedded inside user message rather than top-level provider tools',()=>{
  const report=auditAgentReplayClosure(productTaskExample())
  assert.equal(report.acceptance,'PARTIAL_REPLAY_CLOSURE_PROVEN')
  assert.equal(report.checks.toolCatalogBodyInTopLevelRequest,false)
  assert.equal(report.checks.productTaskPromptToolCatalogExtractable,true)
  assert.equal(report.checks.toolCatalogDigestMatchesOwnerSurface,true)
  assert.equal(report.checks.requestDigestMatchesArchivedJson,true)
  assert.equal(report.checks.responseDigestMatchesArchivedJson,true)
  assert.equal(report.checks.toolResultStubObservationMatchesNextInput,true)
  assert.equal(report.replay.toolCatalog,'IN_MODEL_PROMPT_DIGEST_MATCH')
  assert.equal(report.replay.skillContext,'NOT_APPLICABLE_PRODUCTTASK_DECISION')
  assert.equal(report.replay.isolatedToolReplayL2,'OBSERVATION_STUB_ONLY_NO_CONTROL_FLOW_REPLAY')
  assert.equal(report.replay.fullModelVisibleL0,'PARTIAL')
})

test('tampered Tool catalog digest and observation cannot pass strict owner binding',()=>{
  const bad=productTaskExample()
  bad.material.toolSurfaceDigest=digest
  const result=auditAgentReplayClosure(bad)
  assert.equal(result.checks.toolCatalogDigestMatchesOwnerSurface,false)
  assert.equal(result.replay.toolCatalog,'IN_MODEL_PROMPT_DIGEST_NOT_VERIFIED')
  const badObservation=productTaskExample()
  const second=badObservation.material.modelInteractions[1].requestSnapshot
  second.messages[1].content=second.messages[1].content.replace('SUCCEEDED','FAILED')
  const next=auditAgentReplayClosure(badObservation)
  assert.equal(next.checks.toolResultStubObservationMatchesNextInput,false)
  assert.equal(next.checks.requestDigestMatchesArchivedJson,false)
})
