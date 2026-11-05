import test from 'node:test'
import assert from 'node:assert/strict'
import { samples } from '../site/fixtures.mjs'
import { validateSyntheticRun, allRecords, getSourceLinks, runSummary, defaultOpenSections } from '../site/projection.mjs'

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
