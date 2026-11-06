import test from 'node:test'
import assert from 'node:assert/strict'
import {readLocalReviewDetail, reviewDetailAvailable} from '../site/review-detail.mjs'
import {importReviewDiagnosticFile} from '../site/review-diagnostic.mjs'

function localFile(records) {
  const raw = records.map(x=>JSON.stringify(x)).join('\n')+'\n'
  return {name:'synthetic-review.jsonl',size:Buffer.byteLength(raw),text:async()=>raw}
}
function event(kind,data,material=null) {
  return {kind,data,material,summary:'private summary',diag:'private diagnostic'}
}
test('source data remains absent from the imported presentation by default',async()=>{
  const f=localFile([event('PREDICATE_EVALUATED',{
    verdict:'UNKNOWN',reason:'Await selector did not match',supi:'imsi-001010000000000',
  },{output:{token:'never expose'}})])
  const run=await importReviewDiagnosticFile(f)
  assert.equal(JSON.stringify(run).includes('Await selector'),false)
  assert.equal(JSON.stringify(run).includes('imsi-'),false)
  assert.equal(JSON.stringify(run).includes('never expose'),false)
  assert.equal(run.sections[0].records[0].sourceLine,1)
})
test('explicit per-line inspection returns only safe Predicate and evidence metadata',async()=>{
  const f=localFile([event('PREDICATE_EVALUATED',{
    predicate_identity:'ran_response_received',verdict:'UNKNOWN',
    reason:'Await selector did not match',evidence_refs:['opaque-1','opaque-2'],
    private_value:'imsi-001010000000000',bindings:{session:'Bearer confidential'}
  },{output:{token:'private-token'}})])
  const detail=await readLocalReviewDetail(f,1,'PREDICATE_EVALUATED')
  assert.deepEqual(detail.fields,[
    {label:'Predicate identity',value:'ran_response_received'},
    {label:'Verdict',value:'UNKNOWN'},
    {label:'Reason',value:'Await selector did not match'},
  ])
  assert.equal(detail.evidenceRefCount,2)
  assert.equal(detail.materialReported,true)
  for(const forbidden of ['imsi','Bearer','private-token','opaque-1','bindings','output'])
    assert.equal(JSON.stringify(detail).includes(forbidden),false)
  assert.equal(detail.integrity,'NOT_VERIFIED')
})
test('call result and transition expose allowlisted scalar fields, not arbitrary result bodies',async()=>{
  const f=localFile([
    event('CALL_RESULT',{operation:'smf.create_context',reported_outcome:'COMMITTED',
      outcome:'COMMITTED',bindings:{subscriber:'imsi-123'},output:{token:'abc'}}),
    event('GRAPH_TRANSITION',{source_node_id:'await_ran',selected_edge:'accepted',
      next_node:'finalize',transition_id:'edge-12',data:{secret:'hidden'}}),
  ])
  const call=await readLocalReviewDetail(f,1,'CALL_RESULT')
  assert.equal(call.fields.find(x=>x.label==='Operation').value,'smf.create_context')
  assert.equal(JSON.stringify(call).includes('imsi-123'),false)
  const edge=await readLocalReviewDetail(f,2,'GRAPH_TRANSITION')
  assert.equal(edge.fields.find(x=>x.label==='Next node').value,'finalize')
  assert.equal(edge.materialReported,false)
  assert.equal(JSON.stringify(edge).includes('secret'),false)
})
test('free text and sensitive values fail closed even when key is allowlisted',async()=>{
  const payloads=[
    'imsi-001010000000000','Bearer secret-token','password=topsecret',
    'observe 10.45.0.5','token abc','operator@example.com',
    '{"raw":"text"}','opaque-1234567890123456',
  ]
  for(const reason of payloads){
    const f=localFile([event('PREDICATE_EVALUATED',{reason})])
    const detail=await readLocalReviewDetail(f,1,'PREDICATE_EVALUATED')
    assert.match(detail.fields[0].value,/WITHHELD/)
    assert.equal(JSON.stringify(detail).includes(reason),false)
  }
})
test('unsafe selection, unsupported event kinds and changed source line are rejected',async()=>{
  const f=localFile([event('CALL_RESULT',{operation:'X'})])
  assert.equal(reviewDetailAvailable('CALL_RESULT'),true)
  assert.equal(reviewDetailAvailable('RANDOM_UNKNOWN_KIND'),false)
  for(const [line,kind] of [[2,'CALL_RESULT'],[0,'CALL_RESULT'],[1,'PREDICATE_EVALUATED'],[1,'RANDOM_UNKNOWN_KIND']])
    await assert.rejects(readLocalReviewDetail(f,line,kind),/DETAIL_UNAVAILABLE/)
  const incomplete={...f,text:async()=>'{broken'}
  await assert.rejects(readLocalReviewDetail(incomplete,1,'CALL_RESULT'),/DETAIL_UNAVAILABLE/)
})

test('null reason is NOT PROVIDED rather than withheld, while structured data remains hidden',async()=>{
  const file=localFile([
    event('PREDICATE_EVALUATED',{verdict:'PASS',reason:null}),
    event('PREDICATE_EVALUATED',{verdict:'UNKNOWN',reason:{details:'private-body'}}),
  ])
  const absent=await readLocalReviewDetail(file,1,'PREDICATE_EVALUATED')
  const hidden=await readLocalReviewDetail(file,2,'PREDICATE_EVALUATED')
  assert.equal(absent.fields.find(x=>x.label==='Reason').value,'[NOT PROVIDED IN SOURCE]')
  assert.match(hidden.fields.find(x=>x.label==='Reason').value,/WITHHELD/)
  assert.equal(JSON.stringify(hidden).includes('private-body'),false)
})
