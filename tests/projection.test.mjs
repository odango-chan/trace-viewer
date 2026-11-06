import test from 'node:test'
import assert from 'node:assert/strict'
import { samples } from '../site/fixtures.mjs'
const compact = samples.find(item => item.id === 'synthetic-agent-recovery')
const deterministic = samples.find(item => item.id === 'synthetic-deterministic')
import { validateSyntheticRun, allRecords, getSourceLinks, runSummary, defaultOpenSections, inspectorEvidenceStatus, recordReadingContext, reviewFileNeighbors, sourceOverviewLabel } from '../site/projection.mjs'

test('synthetic cases are explicitly labeled; DSH and deterministic modes remain separate', () => {
  assert.equal(samples.length, 5)
  for (const sample of samples) validateSyntheticRun(sample)
  assert.equal(compact.mode, 'AGENT / MODEL')
  assert.equal(deterministic.mode, 'DETERMINISTIC')
  assert.ok(allRecords(compact).some(item => item.kind === 'MODEL_REQUEST'))
  assert.ok(!allRecords(deterministic).some(item => item.kind === 'MODEL_REQUEST'))
})

test('anomalies are highlighted without conflating Runtime and external states', () => {
  assert.ok(defaultOpenSections(compact).includes('step-1'))
  assert.ok(defaultOpenSections(deterministic).includes('det-external'))
  const terminal = allRecords(deterministic).find(item => item.kind === 'RUNTIME_TERMINAL')
  const disposition = allRecords(deterministic).find(item => item.kind === 'DISPOSITION')
  assert.equal(terminal.status, 'SUCCEEDED')
  assert.equal(disposition.status, 'UNRESOLVED')
})

test('links require exact declared refs; no timestamp or proximity join', () => {
  const result = getSourceLinks(compact, allRecords(compact).find(item => item.kind === 'TOOL_RESULT'))
  assert.deepEqual(result.map(item => item.ref), ['synthetic:toolcall-1','synthetic:reconcile-1'])
  assert.ok(result.every(item => item.target !== null))
  const modified = structuredClone(compact)
  modified.sections[0].records[0].causalRefs = ['unknown-ref']
  const missing = getSourceLinks(modified, modified.sections[0].records[0])
  assert.equal(missing[0].target, null)
  assert.equal(runSummary(modified).missingCausalTargets, 1)
})

test('reject duplicate refs and local sequence collisions; distinct owners may reuse sequence', () => {
  const duplicate = structuredClone(compact)
  duplicate.sections[0].records[1].ref = duplicate.sections[0].records[0].ref
  assert.throws(() => validateSyntheticRun(duplicate), /Repeated record ref/)
  const clash = structuredClone(compact)
  clash.sections[0].records[1].ownerSequence = clash.sections[0].records[0].ownerSequence
  assert.throws(() => validateSyntheticRun(clash), /Duplicate owner-local sequence/)
  assert.doesNotThrow(() => validateSyntheticRun(compact))
})

test('native owner trace is not silently accepted as synthetic projection', () => {
  assert.throws(() => validateSyntheticRun({sourceKind:'REAL',sections:[]}), /synthetic/)
  assert.ok(runSummary(compact).ownerStreams >= 2)
})

test('Inspector evidence claims stay scoped to the actual imported source', () => {
  const record = {ref:'owner:1', materialRef:'a'.repeat(64)}
  const native = {sourceKind:'NATIVE_LOCAL', mode:'NATIVE / AGENT DEMO'}
  const review = {sourceKind:'REVIEW_DIAGNOSTIC', mode:'DIAGNOSTIC / REVIEW EXPORT'}
  assert.equal(inspectorEvidenceStatus(compact, record).label, 'ILLUSTRATION ONLY')
  assert.equal(inspectorEvidenceStatus(native, record).label, 'DIGEST CHECKED · BODY HIDDEN')
  assert.match(inspectorEvidenceStatus(native, record).detail, /Owner Loader validation/)
  assert.equal(inspectorEvidenceStatus(native, {...record,materialRef:null}).label, 'NO MATERIAL REF ON RECORD')
  assert.equal(inspectorEvidenceStatus(review, record).label, 'WITHHELD BY REVIEW READER')
  assert.match(inspectorEvidenceStatus(review, record).detail, /not proof they were absent/)
  assert.equal(sourceOverviewLabel(native), 'Local TraceStore v2')
  assert.equal(sourceOverviewLabel(review), 'Diagnostic review export')
  assert.equal(sourceOverviewLabel(deterministic), 'Deterministic')
})

test('Missing record selection never implies an execution outcome', () => {
  const status = inspectorEvidenceStatus({sourceKind:'NATIVE_LOCAL'}, null)
  assert.equal(status.label, 'NO SOURCE SELECTED')
  assert.doesNotMatch(status.detail, /FAILED|SUCCEEDED/)
})

test('review context gives adjacent physical JSONL lines, never a causal edge',()=>{
  const base = {sourceAuthority:'review-export',ownerSequence:null,kind:'CALL_RESULT',
    title:'source only',summary:'redacted',status:'RECORDED',causalRefs:[]}
  const records = [1,2,3].map(line=>({
    ...base,sourceLine:line,sourceLocator:'test.jsonl#line='+line,
    ref:'review:test.jsonl:line='+line,
  }))
  const run={sourceKind:'REVIEW_DIAGNOSTIC',sections:[
    {id:'part',title:'Physical',subtitle:'Not an Owner sequence',kind:'review-export',records},
  ]}
  assert.equal(reviewFileNeighbors(run,records[0]).previous,null)
  assert.equal(reviewFileNeighbors(run,records[0]).next.ref,records[1].ref)
  assert.equal(reviewFileNeighbors(run,records[1]).previous.ref,records[0].ref)
  assert.equal(reviewFileNeighbors(run,records[2]).next,null)
  assert.equal(reviewFileNeighbors(run,{...records[1],ref:'foreign:ref'}).next,null)
  assert.deepEqual(records.map(x=>x.causalRefs),[[],[],[]])
  assert.deepEqual(reviewFileNeighbors(compact,compact.sections[0].records[0]),{previous:null,next:null})
})
test('review context never jumps over missing lines or to unrelated local files',()=>{
  const first={ref:'review:a.jsonl:line=1',sourceAuthority:'review',
    sourceLine:1,ownerSequence:null,kind:'CALL_RESULT',status:'RECORDED',causalRefs:[]}
  const third={...first,ref:'review:a.jsonl:line=3',sourceLine:3}
  const other={...first,ref:'review:b.jsonl:line=2',sourceLine:2}
  const run={sourceKind:'REVIEW_DIAGNOSTIC',sections:[
    {id:'block',records:[first,other,third]},
  ]}
  assert.equal(reviewFileNeighbors(run,first).next,null)
  assert.equal(reviewFileNeighbors(run,third).previous,null)
})

test('reading context stays inside one section and does not infer cross-owner causality',()=>{
  const run=compact
  const left=run.sections[0].records[0]
  const right=run.sections[0].records[1]
  const c=recordReadingContext(run,left)
  assert.equal(c.sectionTitle,run.sections[0].title)
  assert.equal(c.position,1)
  assert.equal(c.total,run.sections[0].records.length)
  assert.equal(c.previous,null)
  assert.equal(c.next.ref,right.ref)
  assert.equal(recordReadingContext(run,run.sections[0].records.at(-1)).next,null)
  const nextSection=run.sections[1].records[0]
  assert.equal(recordReadingContext(run,nextSection).previous,null)
  assert.deepEqual(recordReadingContext(run,null),{
    sectionTitle:null,position:0,total:0,previous:null,next:null
  })
  assert.deepEqual(recordReadingContext(run,{...left,ref:'fake:source'}),{
    sectionTitle:null,position:0,total:0,previous:null,next:null
  })
  assert.deepEqual(recordReadingContext(run,{...left,sourceAuthority:'foreign:owner'}),{
    sectionTitle:null,position:0,total:0,previous:null,next:null
  })
})

test('review context preserves physical report section bounds without joining runs',async()=>{
  const sample=structuredClone(compact)
  const base=sample.sections[0].records[0]
  assert.equal(recordReadingContext(sample,base).previous,null)
  assert.deepEqual(base.causalRefs, compact.sections[0].records[0].causalRefs)
})
