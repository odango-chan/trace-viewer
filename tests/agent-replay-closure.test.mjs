import assert from 'node:assert/strict'
import test from 'node:test'
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
