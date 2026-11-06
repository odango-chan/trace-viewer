import test from 'node:test'
import assert from 'node:assert/strict'
import { samples } from '../site/fixtures.mjs'
import { VIEW_MODES, projectSectionRows, projectLanes, findPrimaryUnknown } from '../site/console-parity.mjs'
import { validateSyntheticRun, allRecords } from '../site/projection.mjs'

test('four Console reading modes preserve native refs and do not add owner records', () => {
  assert.deepEqual(VIEW_MODES, ['readable', 'model', 'owners', 'raw'])
  for (const sample of samples) {
    validateSyntheticRun(sample)
    const raw = sample.sections.flatMap(section => projectSectionRows(sample, section, 'raw'))
    assert.deepEqual(raw.map(row => row.source.ref), allRecords(sample).map(item => item.ref))
    assert.ok(raw.every(row => row.members.length === 1))
  }
})

test('Model Request and Response fold only by an explicit response causalRef', () => {
  const sample = samples[0]
  const rows = projectSectionRows(sample, sample.sections[0])
  const model = rows.find(row => row.label === 'Model Interaction')
  assert.deepEqual(model.members.map(item => item.ref), ['synthetic:model-req-1', 'synthetic:model-resp-1'])
  assert.ok(!rows.some(row => row.source.ref === 'synthetic:model-resp-1'))
  const broken = structuredClone(sample)
  broken.sections[0].records[1].causalRefs = []
  const fallback = projectSectionRows(broken, broken.sections[0])
  assert.ok(!fallback.some(row => row.label === 'Model Interaction'))
  assert.ok(fallback.some(row => row.source.ref === 'synthetic:model-resp-1'))
})

test('ToolResult folding uses explicit call ref and not arrival order', () => {
  const sample = samples.find(item => item.id === 'synthetic-parallel-tool-results')
  assert.ok(sample)
  const rows = projectSectionRows(sample, sample.sections[0])
  const byCall = rows.filter(row => row.label === 'Tool Interaction')
  assert.equal(byCall.length, 2)
  const a = byCall.find(row => row.source.ref === 'synthetic:parallel-call-a')
  const b = byCall.find(row => row.source.ref === 'synthetic:parallel-call-b')
  assert.equal(a.members[1].ref, 'synthetic:parallel-result-a')
  assert.equal(b.members[1].ref, 'synthetic:parallel-result-b')
  const changed = structuredClone(sample)
  changed.sections[0].records.find(item => item.ref === 'synthetic:parallel-result-a').causalRefs = ['synthetic:parallel-call-b']
  assert.equal(projectSectionRows(changed, changed.sections[0]).filter(row => row.label === 'Tool Interaction').length, 0)
})

test('RESULT_UNKNOWN is Host knowledge, Runtime SUCCEEDED remains distinct', () => {
  const run = samples.find(item => item.id === 'synthetic-host-delivery-gap')
  assert.ok(run)
  validateSyntheticRun(run)
  assert.equal(findPrimaryUnknown(run).status, 'RESULT_UNKNOWN')
  const records = allRecords(run)
  assert.equal(records.find(x => x.kind === 'RUNTIME_TERMINAL').status, 'SUCCEEDED')
  assert.equal(records.find(x => x.kind === 'HOST_DELIVERY').status, 'RESULT_UNKNOWN')
  assert.equal(records.find(x => x.kind === 'TOOL_RESULT').status, 'DELIVERED')
  assert.ok(!records.some(x => x.status === 'OUTCOME_UNKNOWN'))
})

test('Model only excludes Runtime; All owners keeps four separate presentation lanes', () => {
  const sample = samples[0]
  const modelOnly = sample.sections.flatMap(section => projectSectionRows(sample, section, 'model'))
  assert.ok(modelOnly.every(row => row.lane === 'agent'))
  const deterministic = samples.find(item => item.id === 'synthetic-deterministic')
  assert.equal(deterministic.sections.flatMap(section => projectSectionRows(deterministic, section, 'model')).length, 0)
  const lanes = projectLanes(projectSectionRows(sample, sample.sections[1], 'owners'))
  assert.deepEqual(lanes.map(lane => lane.id), ['agent', 'runtime', 'fabric', 'world'])
  assert.ok(lanes.find(lane => lane.id === 'runtime').rows.length > 0)
  assert.equal(lanes.find(lane => lane.id === 'world').rows.length, 0)
  assert.throws(() => projectSectionRows(sample, sample.sections[0], 'invalid'), /Unknown/)
})

test('Focus unknown prioritizes Owner outcome uncertainty, then diagnostic Predicate UNKNOWN', () => {
  const section = {
    id:'review-1',title:'Review',subtitle:'Local report',kind:'review-export',
    records:[
      {ref:'review:1',sourceAuthority:'owner:review',ownerSequence:null,sourceLine:1,kind:'VERIFY_RESULT',status:'FAIL',causalRefs:[],stage:'RUNTIME'},
      {ref:'review:2',sourceAuthority:'owner:review',ownerSequence:null,sourceLine:2,kind:'PREDICATE_EVALUATED',status:'UNKNOWN',causalRefs:[],stage:'RUNTIME'},
    ],
  }
  const run={sourceKind:'REVIEW_DIAGNOSTIC',sections:[section]}
  assert.equal(findPrimaryUnknown(run).ref,'review:2')
  const other=structuredClone(run)
  other.sections[0].records.push({...section.records[0],ref:'review:3',sourceLine:3,status:'OUTCOME_UNKNOWN'})
  assert.equal(findPrimaryUnknown(other).ref,'review:3')
  const certainty=structuredClone(run)
  certainty.sections[0].records[1].status='PASS'
  assert.equal(findPrimaryUnknown(certainty).ref,'review:1')
})
