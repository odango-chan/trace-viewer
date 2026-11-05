import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import { importTraceStoreFiles, NativeImportError } from '../site/native-import.mjs'

const root = process.env.GOLDEN_ROOT
function filesFor(runId) {
  const path = join(root, runId)
  return readdirSync(path, { recursive: true }).filter(name => name !== 'materials' &&
    !name.endsWith(sep) && !name.endsWith('/')).map(name => {
    const buffer = readFileSync(join(path, name))
    const webkitRelativePath = runId + '/' + name.split(sep).join('/')
    return { name: basename(name), webkitRelativePath, size: buffer.length,
      text: async () => buffer.toString('utf8') }
  })
}
function mutate(files, matcher, replace) {
  let replaced = false
  const result = files.map(file => {
    if (!matcher(file)) return file
    replaced = true
    const data = replace(file)
    return { ...file, size: Buffer.byteLength(data), text: async () => data }
  })
  assert.ok(replaced)
  return result
}
function jsonFile(files, name, edit) {
  return mutate(files, f=>f.name===name, f => {
    const v = JSON.parse(readFileSync(join(root,f.webkitRelativePath)).toString('utf8'))
    edit(v)
    return JSON.stringify(v) + '\n'
  })
}

test('Golden: Python TraceRecorder.persist/load_run -> JS parser deterministic', {skip: !root}, async () => {
  const run=await importTraceStoreFiles(filesFor('synthetic-owner-det-v2'))
  assert.equal(run.sourceKind,'NATIVE_LOCAL')
  assert.equal(run.nativeMeta.eventCount,6)
  assert.equal(run.nativeMeta.materialCount,1)
  assert.equal(run.nativeMeta.spanCount,1)
  assert.equal(run.nativeMeta.ownerLoaderVerified,false)
  assert.ok(run.sections.flatMap(x=>x.records).some(x=>x.kind==='PROCEDURE_ENTER'))
  assert.ok(run.sections.flatMap(x=>x.records).every(x=>x.sourceAuthority==='ca-agent-demo'))
})

test('Golden: Python model identity and response explicit source refs', {skip: !root}, async () => {
  const run=await importTraceStoreFiles(filesFor('synthetic-owner-model-v2'))
  const events=run.sections.flatMap(x=>x.records)
  assert.equal(events.length,6)
  const request=events.find(e=>e.kind==='INTENT_MODEL_REQUEST')
  const response=events.find(e=>e.kind==='INTENT_MODEL_RESPONSE')
  assert.deepEqual(response.causalRefs,[request.ref])
  assert.equal(response.materialRef.length,64)
  assert.ok(run.note.includes('NOT performed'))
})

test('Reject unsupported version and mismatch metadata', {skip: !root}, async () => {
  const files=filesFor('synthetic-owner-det-v2')
  await assert.rejects(importTraceStoreFiles(jsonFile(files,'run.json',v=>v.trace_format_version=3)),
    /UNSUPPORTED_VERSION/)
  await assert.rejects(importTraceStoreFiles(jsonFile(files,'run.json',v=>v.run_id='other')),
    /IDENTITY_MISMATCH/)
  await assert.rejects(importTraceStoreFiles(jsonFile(files,'run.json',v=>v.extra=true)),
    /INVALID_SHAPE/)
})

test('Reject sequence gaps, unsorted data, mismatched model counters', {skip: !root}, async () => {
  const det=filesFor('synthetic-owner-det-v2')
  const bad=mutate(det,f=>f.name==='trace.jsonl',f=>{
    const lines=readFileSync(join(root,f.webkitRelativePath),'utf8').trimEnd().split('\n')
    const event=JSON.parse(lines[1]);event.sequence=99
    lines[1]=JSON.stringify(event)
    return lines.join('\n')+'\n'
  })
  await assert.rejects(importTraceStoreFiles(bad),/INVALID_SHAPE/)
  const unsorted=mutate(det,f=>f.name==='trace.jsonl',f=>{
    const lines=readFileSync(join(root,f.webkitRelativePath),'utf8').trimEnd().split('\n')
    const event=JSON.parse(lines[1]);event.data=[['z',1],['a',2]]
    lines[1]=JSON.stringify(event)
    return lines.join('\n')+'\n'
  })
  await assert.rejects(importTraceStoreFiles(unsorted),/INVALID_SHAPE/)
  const model=filesFor('synthetic-owner-model-v2')
  await assert.rejects(importTraceStoreFiles(jsonFile(model,'run.json',v=>{
    v.intentInterpretationLlmCalls=0;v.totalLlmCalls=0
  })),/IDENTITY_MISMATCH/)
})

test('Reject missing, changed, or malicious materials', {skip: !root}, async () => {
  const files=filesFor('synthetic-owner-det-v2')
  await assert.rejects(importTraceStoreFiles(files.filter(x=>!x.webkitRelativePath.includes('/materials/'))),
    /INCOMPLETE_BUNDLE/)
  const bad=mutate(files,x=>x.webkitRelativePath.includes('/materials/'),()=>'{\"facts\":[\"only-test\"],\"synthetic\":true,\"unicode\":\"篡改\"}\n')
  await assert.rejects(importTraceStoreFiles(bad),/DIGEST_MISMATCH/)
  const unsafe=mutate(files,x=>x.webkitRelativePath.includes('/materials/'),()=>'{\"api_key\":\"do-not-share\"}\n')
  await assert.rejects(importTraceStoreFiles(unsafe),/UNSAFE_CONTENT/)
})

test('Reject secret-bearing pair-array, incomplete JSONL, path traversal', {skip: !root}, async () => {
  const files=filesFor('synthetic-owner-det-v2')
  const unsafe=mutate(files,f=>f.name==='trace.jsonl',f=>{
    const lines=readFileSync(join(root,f.webkitRelativePath),'utf8').trimEnd().split('\n')
    const event=JSON.parse(lines[0]);event.data=[['api_key','unsafe']]
    lines[0]=JSON.stringify(event)
    return lines.join('\n')+'\n'
  })
  await assert.rejects(importTraceStoreFiles(unsafe),/UNSAFE_CONTENT/)
  const truncated=mutate(files,f=>f.name==='trace.jsonl',f=>
    readFileSync(join(root,f.webkitRelativePath),'utf8').trimEnd())
  await assert.rejects(importTraceStoreFiles(truncated),/INCOMPLETE_BUNDLE/)
  const traversal=files.map(f=>f.name==='run.json'?{...f,webkitRelativePath:'../run.json'}:f)
  await assert.rejects(importTraceStoreFiles(traversal),/UNSAFE_CONTENT/)
})

test('Reject missing run metadata and extra unrelated files', {skip: !root}, async () => {
  const files=filesFor('synthetic-owner-det-v2')
  await assert.rejects(importTraceStoreFiles(files.filter(x=>x.name!=='run.json')),/INCOMPLETE_BUNDLE/)
  await assert.rejects(importTraceStoreFiles([...files,{name:'other.json',webkitRelativePath:'synthetic-owner-det-v2/other.json',size:2,text:async()=>'{}'}]),/UNSAFE_CONTENT/)
})
