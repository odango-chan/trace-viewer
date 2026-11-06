import test from 'node:test'
import assert from 'node:assert/strict'
import { samples } from '../site/fixtures.mjs'
import { allRecords, defaultOpenSections, getSourceLinks, inspectorEvidenceStatus, runSummary, validateSyntheticRun } from '../site/projection.mjs'
import { projectSectionRows } from '../site/console-parity.mjs'

const complete = samples.find(run => run.id === 'synthetic-console-release-session-10')
const originalIds = [
  'synthetic-agent-recovery',
  'synthetic-deterministic',
  'synthetic-host-delivery-gap',
  'synthetic-parallel-tool-results',
]

test('complete Console reference is default; four original regression examples stay available', () => {
  assert.equal(samples[0].id, complete.id)
  assert.deepEqual(samples.slice(1).map(item => item.id), originalIds)
  assert.deepEqual(complete.sections.map(s => s.id), [
    'console-setup','console-skill','console-query-before',
    'console-release','console-confirm','console-final',
  ])
  assert.match(complete.title, /Release PDU Session 10/)
  assert.match(complete.note, /not a real run|NOT a real run/i)
  validateSyntheticRun(complete)
})

test('full story has distinct source facts for six runtime phases, owner boundaries, and final confirmation', () => {
  const all = allRecords(complete)
  assert.ok(all.length >= 37)
  const status = runSummary(complete)
  assert.equal(status.events, all.length)
  assert.equal(status.missingCausalTargets, 0)
  assert.equal(status.ownerStreams, 5)
  assert.deepEqual(defaultOpenSections(complete), ['console-release'])
  const types = new Set(all.map(rec => rec.kind))
  for (const kind of ['SKILL_ELIGIBILITY','SKILL_LOAD_RESULT','EXECUTION_BINDING',
    'GOAL_TOOLSET','AUTHORIZATION','ASSURANCE','DISPATCH','OUTCOME',
    'VERIFICATION','RECONCILE','RUNTIME_TERMINAL','TASK_TERMINAL']) assert.ok(types.has(kind), kind)
  assert.equal(all.find(x => x.kind === 'OUTCOME').status, 'OUTCOME_UNKNOWN')
  assert.equal(all.find(x => x.kind === 'RECONCILE').status, 'COMMITTED')
  assert.equal(all.find(x => x.kind === 'RUNTIME_TERMINAL').status, 'SUCCEEDED')
  assert.equal(all.find(x => x.kind === 'TASK_TERMINAL').status, 'COMPLETED')
  assert.equal(all.find(x => x.ref.endsWith(':release-result')).status, 'DELIVERED')
  assert.equal(all.find(x => x.ref.endsWith(':confirm-absent')).sourceAuthority,'synthetic:world')
  assert.equal(all.find(x => x.ref.endsWith(':fabric-loss')).sourceAuthority,'synthetic:fabric')
  for (const rec of all) assert.ok(getSourceLinks(complete,rec).every(link => link.target), rec.ref)
})

test('Model and Tool pairing preserves source IDs, never joins by arrival order', () => {
  const bySection = new Map(complete.sections.map(section => [section.id,projectSectionRows(complete,section)]))
  const folds = ['console-skill','console-query-before','console-release',
    'console-confirm','console-final'].flatMap(id => bySection.get(id).filter(row => row.isFolded))
  const modelPairs = folds.filter(row => row.label === 'Model Interaction')
  const toolPairs = folds.filter(row => row.label === 'Tool Interaction')
  assert.equal(modelPairs.length, 5)
  assert.equal(toolPairs.length, 4)
  assert.ok(modelPairs.every(row => row.members[1].causalRefs.includes(row.source.ref)))
  assert.ok(toolPairs.every(row => row.members[1].causalRefs.includes(row.source.ref)))
  const unknown = bySection.get('console-release').find(row => row.source.ref.endsWith(':release-unknown'))
  assert.equal(unknown.source.status,'OUTCOME_UNKNOWN')
})

test('only the synthetic story carries public illustrative panels, not real material or a System Prompt', () => {
  const all=allRecords(complete)
  const request=all.find(rec=>rec.ref.endsWith(':query1-input'))
  assert.ok(request.illustration)
  assert.deepEqual(request.illustration.panels.slice(0,4).map(panel=>panel.title), [
    'System · simulated','Context · simulated','Skill · simulated','Tools · simulated',
  ])
  const routing=all.find(rec=>rec.ref.endsWith(':route-request'))
  assert.match(routing.illustration.panels.find(p=>p.title==='Usage').content,/UNAVAILABLE/)
  assert.equal(inspectorEvidenceStatus(complete,request).label,'ILLUSTRATION ONLY')
  const json=JSON.stringify(complete)
  assert.doesNotMatch(json,/imsi-[0-9]{10,}|sk-[A-Za-z0-9]{15,}/)
  assert.ok(all.every(rec=>rec.ref.startsWith('synthetic:console-release:')))
  assert.ok(all.every(rec=>rec.sourceAuthority.startsWith('synthetic:')))
})

test('scripted knowledge boundaries separate model input/output and Tool Call/ToolResult', () => {
  const all = allRecords(complete)
  const byId = id => all.find(rec => rec.ref.endsWith(':' + id))
  const panels = id => byId(id).illustration?.panels ?? []
  for (const id of ['route-request','query1-input','release-input','query2-input','final-input']) {
    assert.ok(panels(id).length, id + ' must carry the illustrative input surface')
    assert.ok(panels(id).every(panel => !/^(Response|Output|Delivery)\b/i.test(panel.title)),
      id + ' must not show a later output on the model request')
  }
  for (const id of ['route-response','query1-response','release-response','query2-response','final-response']) {
    assert.ok(panels(id).some(panel => /^(Response|Output)\b/i.test(panel.title)),
      id + ' must place generated output on the response source')
  }
  for (const id of ['query1-call','release-call','query2-call']) {
    const rec=byId(id)
    assert.ok(rec.illustration, id)
    assert.ok(rec.illustration.fields.every(field => field.label !== 'Result'), id)
    assert.ok(panels(id).every(panel => !/^Delivery\b/i.test(panel.title)), id)
    assert.match(panels(id).find(panel => panel.title === 'Result availability').content, /UNAVAILABLE/)
    assert.equal(rec.status,'REQUESTED')
  }
  for (const id of ['query1-result','release-result','query2-result']) {
    const rec=byId(id)
    assert.ok(rec.illustration.fields.some(field => field.label === 'Result'), id)
    assert.ok(panels(id).some(panel => /^Delivery\b/i.test(panel.title)), id)
    assert.equal(rec.status,'DELIVERED')
  }
  assert.match(panels('release-unknown').at(0).content, /Host RESULT_UNKNOWN/)
  assert.equal(runSummary(complete).missingCausalTargets, 0)
})
