import test from 'node:test'
import assert from 'node:assert/strict'
import {importReviewFindingFile} from '../site/review-finding.mjs'

const sample={
  owner:'local-demo',
  outcome:'UNRESOLVED',
  firstFailureStage:'RAN Adoption',
  firstFailureNode:'await-result',
  predicate:'observation.received',
  ownerResult:{reason:'WAIT_BUDGET_EXHAUSTED',observationsUsed:3},
  networkEffect:'NONE: network accepted; no mutation replayed',
  fix:{waitScope:'Requires exact attempt selector',
       procedureBindings:'Local scope must bind expected source'},
  bindingsSupplied:{purpose:'test',operationContextRef:'unrelated-source'},
  rootCause:'Sensitive free text imsi-001010123456789 do not export',
  ownerComponents:['internal/private'],
  spanDurationMs:[0.1,0.2],
  attempt2Observation:'Private parallel run must not auto-link',
}
function mock(note=sample, name='synthetic-diagnosis.json') {
  const content=JSON.stringify(note)
  return {name,size:Buffer.byteLength(content),text:async()=>content}
}
test('standalone diagnosis projects source assertions, not invented events or run links',async()=>{
  const view=await importReviewFindingFile(mock())
  assert.equal(view.sourceKind,'REVIEW_FINDING')
  assert.equal(view.ownerSequence,null)
  assert.equal(view.runAssociation,'NOT_ESTABLISHED')
  assert.equal(view.evidenceIntegrity,'NOT_VERIFIED')
  assert.equal(view.fields.find(x=>x.label==='First failure stage').value,'RAN Adoption')
  assert.equal(view.fields.find(x=>x.label==='Reported wait reason').value,'WAIT_BUDGET_EXHAUSTED')
  assert.equal(view.fields.find(x=>x.label==='Reported observations used').value,'3')
  assert.deepEqual(view.bindingNames,['operationContextRef','purpose'])
  assert.equal(Object.hasOwn(view,'sections'),false)
  assert.equal(Object.hasOwn(view,'causalRefs'),false)
})
test('raw root cause, identifiers, remote source fields and arbitrary keys never leak',async()=>{
  const view=await importReviewFindingFile(mock())
  const text=JSON.stringify(view)
  for(const forbidden of ['imsi-','123456789','unrelated-source','internal/private','Private parallel run'])
    assert.equal(text.includes(forbidden),false)
  assert.equal(view.suppressedOriginalText,true)
  const modified={...sample,networkEffect:'Authorization: Bearer local-secret'}
  const hidden=await importReviewFindingFile(mock(modified))
  assert.ok(!hidden.fields.some(f=>f.label==='Reported network effect'))
  assert.equal(JSON.stringify(hidden).includes('Bearer local-secret'),false)
})
test('reject malformed JSON, unknown shapes, oversized and identifying filenames',async()=>{
  const bad=[
    {...mock(),text:async()=>'{broken'},
    mock({...sample,firstFailureNode:undefined}),
    mock({...sample,arbitrarySecret:'private'}),
    {name:'report.json',size:100000,text:async()=>''},
    mock(sample,'../../escape.json'),
    mock(sample,'imsi-001010123456789.json'),
  ]
  for(const input of bad)await assert.rejects(importReviewFindingFile(input),/INVALID_SHAPE|UNSAFE_CONTENT/)
})
test('block sensitive required fields rather than presenting untrusted report claims',async()=>{
  for(const field of ['firstFailureStage','firstFailureNode']){
    const input={...sample,[field]:'imsi-001010123456789'}
    await assert.rejects(importReviewFindingFile(mock(input)),/INVALID_SHAPE/)
  }
  const hostile={...sample,bindingsSupplied:{token:'SECRET_VALUE'}}
  const parsed=await importReviewFindingFile(mock(hostile))
  assert.deepEqual(parsed.bindingNames,[])
  assert.equal(JSON.stringify(parsed).includes('SECRET_VALUE'),false)
})
