import test from 'node:test'
import assert from 'node:assert/strict'
import { samples } from '../site/fixtures.mjs'
import { validateSyntheticRun, allRecords, getSourceLinks, runSummary, defaultOpenSections, inspectorEvidenceStatus, reviewFileNeighbors, sourceOverviewLabel } from '../site/projection.mjs'

test('synthetic cases are explicitly labeled; DSH and deterministic modes remain separate', () => {
  assert.equal(samples.length, 4)
  for (const sample of samples) validateSyntheticRun(sample)
  assert.equal(samples[0].mode, 'AGENT / MODEL')
  assert.equal(samples[1].mode, 'DETERMINISTIC')
  assert.ok(allRecords(samples[0]).some(item => item.kind === 'MODEL_REQUEST'))
  assert.ok(!allRecords(samples[1]).some(item => item.kind === 'MODEL_REQUEST'))
})

test('anomalies are highlighted without conflating Runtime and external states', () => {
  assert.ok(defaultOpenSections(samples[0]).includes('step-1'))
  assert.ok(defaultOpenSections(samples[1]).includes('det-external'))
  const terminal = allRecords(samples[1]).find(item => item.kind === 'RUNTIME_TERMINAL')
  const disposition = allRecords(samples[1]).find(item => item.kind === 'DISPOSITION')
  assert.equal(terminal.status, 'SUCCEEDED')
  assert.equal(disposition.status, 'UNRESOLVED')
})

test('links require exact declared refs; no timestamp or proximity join', () => {
  const result = getSourceLinks(samples[0], allRecords(samples[0]).find(item => item.kind === 'TOOL_RESULT'))
  assert.deepEqual(result.map(item => item.ref), ['synthetic:toolcall-1','synthetic:reconcile-1'])
  assert.ok(result.every(item => item.target !== null))
  const modified = structuredClone(samples[0])
  modified.sections[0].records[0].causalRefs = ['unknown-ref']
  const missing = getSourceLinks(modified, modified.sections[0].records[0])
  assert.equal(missing[0].target, null)
  assert.equal(runSummary(modified).missingCausalTargets, 1)
})

test('reject duplicate refs and local sequence collisions; distinct owners may reuse sequence', () => {
  const duplicate = structuredClone(samples[0])
  duplicate.sections[0].records[1].ref = duplicate.sections[0].records[0].ref
  assert.throws(() => validateSyntheticRun(duplicate), /Repeated record ref/)
  const clash = structuredClone(samples[0])
  clash.sections[0].records[1].ownerSequence = clash.sections[0].records[0].ownerSequence
  assert.throws(() => validateSyntheticRun(clash), /Duplicate owner-local sequence/)
  assert.doesNotThrow(() => validateSyntheticRun(samples[0]))
})

test('native owner trace is not silently accepted as synthetic projection', () => {
  assert.throws(() => validateSyntheticRun({sourceKind:'REAL',sections:[]}), /synthetic/)
  assert.ok(runSummary(samples[0]).ownerStreams >= 2)
})

test('Inspector evidence claims stay scoped to the actual imported source', () => {
  const record = {ref:'owner:1', materialRef:'a'.repeat(64)}
  const native = {sourceKind:'NATIVE_LOCAL', mode:'NATIVE / AGENT DEMO'}
  const review = {sourceKind:'REVIEW_DIAGNOSTIC', mode:'DIAGNOSTIC / REVIEW EXPORT'}
  assert.equal(inspectorEvidenceStatus(samples[0], record).label, 'ILLUSTRATION ONLY')
  assert.equal(inspectorEvidenceStatus(native, record).label, 'DIGEST CHECKED · BODY HIDDEN')
  assert.match(inspectorEvidenceStatus(native, record).detail, /Owner Loader validation/)
  assert.equal(inspectorEvidenceStatus(native, {...record,materialRef:null}).label, 'NO MATERIAL REF ON RECORD')
  assert.equal(inspectorEvidenceStatus(review, record).label, 'WITHHELD BY REVIEW READER')
  assert.match(inspectorEvidenceStatus(review, record).detail, /not proof they were absent/)
  assert.equal(sourceOverviewLabel(native), 'Local TraceStore v2')
  assert.equal(sourceOverviewLabel(review), 'Diagnostic review export')
  assert.equal(sourceOverviewLabel(samples[1]), 'Deterministic')
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
  assert.deepEqual(reviewFileNeighbors(samples[0],samples[0].sections[0].records[0]),{previous:null,next:null})
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
