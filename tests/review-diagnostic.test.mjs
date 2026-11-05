import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { importReviewDiagnosticFile } from '../site/review-diagnostic.mjs'
import { allRecords } from '../site/projection.mjs'

const span={
  kind:'span',name:'Synthetic operation',stage:'TraceStage.RUNTIME',
  status:'SpanStatus.COMPLETED',startedAt:'2026-01-01T00:00:00Z',
  endedAt:'2026-01-01T00:00:01Z',durationMs:10.5
}
const ev={
  kind:'CALL_RESULT',
  summary:'supi imsi-secret-not-for-display',
  diag:'secret diagnostic message',
  data:{outcome:'COMMITTED',procedure_invocation_id:'private-invocation',subscriber:'imsi-test-secret'},
  material:{authorization:'Bearer should-not-render',output:{token:'private-material'}}
}
function mockFile(rows, name='synthetic-diagnostic.jsonl') {
  const text=rows.map(row=>typeof row==='string'?row:JSON.stringify(row)).join('\n')+'\n'
  return {name,size:Buffer.byteLength(text),text:async()=>text}
}
test('review-export is distinct from owner-native TraceStore and has file line only',async()=>{
  const run=await importReviewDiagnosticFile(mockFile([span,ev]))
  assert.equal(run.sourceKind,'REVIEW_DIAGNOSTIC')
  assert.equal(run.reviewMeta.sourceContract,'UNVERSIONED_REVIEW_EXPORT')
  assert.deepEqual([run.reviewMeta.spanCount,run.reviewMeta.eventCount,run.reviewMeta.lineCount],[1,1,2])
  const records=allRecords(run)
  assert.deepEqual(records.map(x=>x.ownerSequence),[null,null])
  assert.deepEqual(records.map(x=>x.sourceLine),[1,2])
  assert.equal(records[1].sourceLocator,'synthetic-diagnostic.jsonl#line=2')
  assert.equal(records[1].status,'COMMITTED')
  assert.deepEqual(records[1].causalRefs,[])
  assert.equal(run.reviewMeta.ownerLoaderVerified,false)
  assert.equal(run.reviewMeta.eventTimestamp,'NOT_PRESENT')
})
test('review export discards all potentially sensitive summary, diag, material and data bodies',async()=>{
  const run=await importReviewDiagnosticFile(mockFile([span,ev]))
  const output=JSON.stringify(run)
  for(const forbidden of ['supi','imsi-secret','authorization','Bearer','should-not-render',
                          'private-material','private-invocation','subscriber','secret diagnostic'])
    assert.equal(output.includes(forbidden),false)
  assert.match(output,/Raw summary\/material hidden/)
})
test('review reader fails closed on malformed records, incomplete lines, unknown shape and oversized files',async()=>{
  const bads=[
    mockFile(['not JSON']),
    mockFile([{...ev,wrongKey:true}]),
    mockFile([{...span,durationMs:-1}]),
    mockFile([{kind:'irrelevant',data:{},diag:'',summary:'',material:{}}]),
    {name:'test.jsonl',size:20000000,text:async()=>''},
    {name:'../../bad.jsonl',size:10,text:async()=>''},
  ]
  for(const f of bads)await assert.rejects(importReviewDiagnosticFile(f), /INVALID_SHAPE|UNSAFE_CONTENT/)
  await assert.rejects(importReviewDiagnosticFile({
    name:'unclosed.jsonl',size:10,text:async()=>JSON.stringify(ev)
  }),/INCOMPLETE_EXPORT/)
})

test('private archived P8-D4 export retains only safe, aggregate source metadata', {skip:!process.env.REAL_DIAGNOSTIC_PATH},async()=>{
  const path=process.env.REAL_DIAGNOSTIC_PATH
  const buffer=readFileSync(path)
  const run=await importReviewDiagnosticFile({
    name:basename(path),size:buffer.length,text:async()=>buffer.toString('utf8')
  })
  assert.equal(run.reviewMeta.lineCount,106)
  assert.equal(run.reviewMeta.spanCount,21)
  assert.equal(run.reviewMeta.eventCount,85)
  assert.equal(allRecords(run).length,106)
  assert.ok(allRecords(run).every(x=>x.ownerSequence===null&&x.causalRefs.length===0))
  assert.ok(allRecords(run).every(x=>!Object.hasOwn(x,'nativeData')&&!Object.hasOwn(x,'material')))
  // Never print or upload source values; only these count-level checks.
  console.log('REDACTED_REAL_DIAGNOSTIC_PASS: 106 rows, 21 spans, 85 events, zero fabricated owner sequences')
})
