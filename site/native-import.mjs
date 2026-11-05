/**
 * ca-agent-demo TraceStore/v2 offline DIRECTORY reader.
 * Strict subset of writer output; no network, persistence or execution.
 * Accepted browser data is NOT automatically certified by the owner's load_run().
 */
const META = new Set(['trace_format_version','run_id','intentInterpretationLlmCalls','skillRoutingLlmCalls','planningLlmCalls','totalLlmCalls','started_at','ended_at','duration_ms','spans'])
const EVENT = new Set(['sequence','stage','kind','summary','data','material_ref'])
const SPAN = new Set(['span_id','name','stage','status','started_at','ended_at','duration_ms','parent_id','attributes'])
const STAGES = new Set(['HOST','INTENT','SKILL_ROUTING','CONTEXT','PREDEFINED','FORMAL','LLM_PLANNING','LINKER','ADMISSION','RUNTIME','REPLAN'])
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const HASH = /^[a-f0-9]{64}$/
const SECRET = /(?:api[_-]?key|access[_-]?token|password|credential|secret|authorization|provider[_-]?binding|runtime[_-]?pc|raw[_-]?evidence|chain[_-]?of[_-]?thought|reasoning|scratchpad|internal[_-]?thought|analysis|thinking)/i
const SECRET_VALUE = /(?:sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{16,})/i
const MAX_TOTAL = 20 * 1024 * 1024, MAX_FILE = 8 * 1024 * 1024, MAX_FILES = 120, MAX_EVENTS = 30000

export class NativeImportError extends Error {
  constructor(code, reason) {
    super(code + ': ' + reason)
    this.name = 'NativeImportError'
    this.code = code
  }
}

function reject(code, reason) { throw new NativeImportError(code, reason) }
function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function keysExactly(v, required) {
  return object(v) && Object.keys(v).length === required.size && Object.keys(v).every(k => required.has(k))
}
function safe(v, loc = '$', depth = 0) {
  if (depth > 24) reject('UNSAFE_CONTENT', loc + ': nesting too deep')
  if (object(v)) for (const [k, value] of Object.entries(v)) {
    if (SECRET.test(k)) reject('UNSAFE_CONTENT', loc + ': secret-like key')
    safe(value, loc + '.' + k, depth + 1)
  }
  else if (Array.isArray(v)) for (const item of v) safe(item, loc + '[]', depth + 1)
  else if (typeof v === 'string') {
    if (SECRET_VALUE.test(v)) reject('UNSAFE_CONTENT', loc + ': credential-like value')
    if (v.length > 8192) reject('UNSAFE_CONTENT', loc + ': oversized text')
    if (/^[\s]*[[{]/.test(v)) {
      try { const parsed = JSON.parse(v); if (object(parsed) || Array.isArray(parsed)) safe(parsed, loc + '.json', depth + 1) }
      catch (e) { if (e instanceof NativeImportError) throw e }
    }
  }
}
function jsonStrict(txt, name) {
  try {
    const value = JSON.parse(txt)
    safe(value, name)
    return value
  } catch (e) {
    if (e instanceof NativeImportError) throw e
    reject('INVALID_SHAPE', name + ' is not valid JSON')
  }
}
function timestamp(v) { return typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /(?:Z|[+-]\d\d:\d\d)$/.test(v) }
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (object(v)) return '{' + Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',') + '}'
  return JSON.stringify(v)
}
async function digest(text) {
  const raw = new TextEncoder().encode(text)
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', raw))
  return [...bytes].map(b => b.toString(16).padStart(2,'0')).join('')
}
function eventKindStatus(kind) {
  // Only explicitly authored terminal kinds carry terminal meaning. Other
  // text, material content and adjacent events never become a business status.
  return ({RUN_SUCCEEDED:'SUCCEEDED', RUN_FAILED:'FAILED', SAFE_STOP:'SAFE_STOPPED'}[kind] ?? 'RECORDED')
}
function modelKey(data) {
  if (!object(data) || typeof data.model_stage !== 'string' ||
      !Number.isInteger(data.call_index) || data.call_index < 1 ||
      data.model_call_id !== data.model_stage + ':' + data.call_index) return null
  return data.model_stage + ':' + data.call_index
}
function checkModel(events, meta) {
  const stages = [
    ['intent','INTENT_MODEL_REQUEST','intentInterpretationLlmCalls'],
    ['skill-routing','SKILL-ROUTING_MODEL_REQUEST','skillRoutingLlmCalls'],
    ['planning','PLANNING_MODEL_REQUEST','planningLlmCalls'],
  ]
  const responseKinds = {
    INTENT_MODEL_RESPONSE:'INTENT_MODEL_REQUEST',
    'SKILL-ROUTING_MODEL_RESPONSE':'SKILL-ROUTING_MODEL_REQUEST',
    PLANNING_MODEL_RESPONSE:'PLANNING_MODEL_REQUEST',
    INTENT_MODEL_VALIDATION:'INTENT_MODEL_REQUEST',
    SKILL_ROUTING_MODEL_VALIDATION:'SKILL-ROUTING_MODEL_REQUEST',
    PLANNING_MODEL_VALIDATION:'PLANNING_MODEL_REQUEST'
  }
  const calls = new Map()
  for (const [stage,kind] of stages) calls.set(kind,new Map())
  const responseSeen = new Set()
  const correlated = new Map()
  for (const ev of events) {
    const stage = stages.find(x=>x[1]===ev.kind)
    const requestKind = stage ? ev.kind : responseKinds[ev.kind]
    if (!requestKind) continue
    const wanted = stages.find(x=>x[1]===requestKind)
    const id = modelKey(ev.data)
    if (!id || ev.data.model_stage !== wanted[0]) reject('IDENTITY_MISMATCH', 'model call identity at seq '+ev.sequence)
    const reqs = calls.get(requestKind)
    if (stage) {
      if (reqs.has(ev.data.call_index)) reject('IDENTITY_MISMATCH','duplicate model request')
      reqs.set(ev.data.call_index,ev)
    } else {
      const source = reqs.get(ev.data.call_index)
      if (!source) reject('IDENTITY_MISMATCH','response/validation without earlier request')
      const unique = ev.kind+':'+id
      if (responseSeen.has(unique)) reject('IDENTITY_MISMATCH','duplicate model response/validation')
      responseSeen.add(unique)
      correlated.set(ev.sequence,source.sequence)
      if (ev.kind.endsWith('_MODEL_VALIDATION')) {
        const response = requestKind.replace('REQUEST','RESPONSE')+':'+id
        if (!responseSeen.has(response)) reject('IDENTITY_MISMATCH','model validation without response')
      }
    }
  }
  for (const [stage,requestKind,counter] of stages) {
    const ids = [...calls.get(requestKind).keys()].sort((a,b)=>a-b)
    if (ids.length !== meta[counter] || ids.some((id,i)=>id!==i+1))
      reject('IDENTITY_MISMATCH',stage+' model call count mismatch')
  }
  return correlated
}
function checkProcedure(events) {
  const kinds = new Set(['PROCEDURE_ENTER','PROCEDURE_NODE_ENTER','PROCEDURE_TERMINAL','CHILD_INVOCATION','CALL_RESULT','RECONCILE_RESULT','RETRY_EDGE','GRAPH_TRANSITION','SKILL_RESULT'])
  const groups = new Map()
  for (const ev of events) {
    if (ev.stage !== 'RUNTIME') continue
    const d = ev.data
    if (!kinds.has(ev.kind) && !(ev.kind==='VERIFY_RESULT' &&
      ['ROOT','CHILD','CHILD_HARD_PRECONDITION','CHILD_COMPOSITION_POSTCONDITION'].includes(d.scope))) continue
    if (!Number.isInteger(d.attempt)||d.attempt<1||!d.procedure_invocation_id||
        !['ROOT','CHILD'].includes(d.owner_kind)||typeof d.skill!=='string'||!d.skill||
        typeof d.procedure!=='string'||!d.procedure)
      reject('IDENTITY_MISMATCH','incomplete Procedure lineage at seq '+ev.sequence)
    const key=d.attempt+'|'+d.procedure_invocation_id, identity=d.owner_kind+'|'+d.skill+'|'+d.procedure
    const prev=groups.get(key)??{identity,entered:false,children:0}
    if(prev.identity!==identity)reject('IDENTITY_MISMATCH','conflicting Procedure identity')
    if(ev.kind==='CHILD_INVOCATION'){
      if(d.owner_kind!=='CHILD'||typeof d.parent_procedure_invocation_id!=='string'||
        !d.parent_procedure_invocation_id||!Number.isInteger(d.occurrence)||d.occurrence<0)
        reject('IDENTITY_MISMATCH','invalid Child invocation')
      prev.children++
    }
    if(ev.kind==='PROCEDURE_ENTER')prev.entered=true
    groups.set(key,prev)
  }
  for (const g of groups.values()) if(g.children>1||(g.identity.startsWith('CHILD|')&&g.entered&&g.children!==1))
    reject('IDENTITY_MISMATCH','duplicate/missing Child lineage record')
}
function checkSpans(spans) {
  if (!Array.isArray(spans) || spans.length > 5000)reject('INVALID_SHAPE','invalid spans array')
  const seen=new Set()
  for (const span of spans) {
    if(!keysExactly(span,SPAN)||typeof span.span_id!=='string'||!span.span_id||seen.has(span.span_id)||
       !STAGES.has(span.stage)||!['RUNNING','COMPLETED','FAILED'].includes(span.status)||
       !timestamp(span.started_at)||!(span.ended_at===null||timestamp(span.ended_at))||
       (span.status==='RUNNING') !== (span.ended_at===null)||
       typeof span.duration_ms!=='number'||!Number.isFinite(span.duration_ms)||span.duration_ms<0||
       typeof span.name!=='string'||!span.name||!object(span.attributes)||
       (span.parent_id!==null&&!seen.has(span.parent_id)))
      reject('INVALID_SHAPE','invalid span identity, stage, timing or parent')
    seen.add(span.span_id)
  }
}
function validatedFileMap(files) {
  if (!Array.isArray(files)||files.length<2)reject('INCOMPLETE_BUNDLE','select a TraceStore run directory')
  if(files.length>MAX_FILES)reject('UNSAFE_CONTENT','too many files')
  const map=new Map(); let total=0
  for (const file of files) {
    if (!file||typeof file.text!=='function'||typeof file.size!=='number'||file.size>MAX_FILE)
      reject('UNSAFE_CONTENT','invalid or oversized file')
    total+=file.size
    if(total>MAX_TOTAL)reject('UNSAFE_CONTENT','bundle too large')
    const path=(file.webkitRelativePath||file.name).replaceAll('\\','/')
    const parts=path.split('/')
    if(parts.some(x=>x===''||x==='.'||x==='..')||path.startsWith('/'))reject('UNSAFE_CONTENT','unsafe relative path')
    // One selected run directory only, not an arbitrary list of sibling runs.
    const prefix=parts.slice(0,-1)
    const relative=(parts.length>1?parts.slice(-2).join('/'):parts[0])
    if(parts.length>1&&!ID.test(parts[parts.length-2]) && parts[parts.length-2]!=='materials')
      reject('UNSAFE_CONTENT','unexpected run directory name')
    const key=parts[parts.length-1]==='run.json'||parts[parts.length-1]==='trace.jsonl'
      ?parts[parts.length-1]:relative
    if(map.has(key))reject('INVALID_SHAPE','duplicate file '+key)
    map.set(key,file)
  }
  if(!map.has('run.json')||!map.has('trace.jsonl'))reject('INCOMPLETE_BUNDLE','run.json / trace.jsonl required')
  for (const key of map.keys()) if(key!=='run.json'&&key!=='trace.jsonl'&&!/^materials\/[a-f0-9]{64}\.json$/.test(key))
    reject('UNSAFE_CONTENT','unexpected bundle file')
  return map
}

export async function importTraceStoreFiles(fileList) {
  const files=Array.from(fileList ?? [])
  const map=validatedFileMap(files)
  const meta=jsonStrict(await map.get('run.json').text(),'run.json')
  if(!keysExactly(meta,META))reject('INVALID_SHAPE','run.json must have exact 10 keys')
  if(meta.trace_format_version!==2)reject('UNSUPPORTED_VERSION','requires TraceStore v2')
  if(typeof meta.run_id!=='string'||!ID.test(meta.run_id))reject('IDENTITY_MISMATCH','unsafe run_id')
  const selectedPaths=files.map(f=>f.webkitRelativePath||f.name).filter(p=>p.includes('/'))
  const roots=new Set(selectedPaths.map(p=>p.split('/').slice(0,-1).filter(x=>x!=='materials').join('/')))
  if(roots.size>1)reject('INVALID_SHAPE','select one run directory')
  if(selectedPaths.length&& !selectedPaths.some(p=>p.split('/').includes(meta.run_id)))
    reject('IDENTITY_MISMATCH','selected folder does not match run_id')
  const names=['intentInterpretationLlmCalls','skillRoutingLlmCalls','planningLlmCalls','totalLlmCalls']
  const counts=names.map(k=>meta[k])
  if(counts.some(c=>!Number.isSafeInteger(c)||c<0)||counts[3]!==counts[0]+counts[1]+counts[2])
    reject('INVALID_SHAPE','LLM counters invalid')
  if(!timestamp(meta.started_at)||!timestamp(meta.ended_at)||typeof meta.duration_ms!=='number'||
     !Number.isFinite(meta.duration_ms)||meta.duration_ms<0)
    reject('INVALID_SHAPE','invalid Run timestamps/duration')
  checkSpans(meta.spans)
  const trace=await map.get('trace.jsonl').text()
  if(trace && !trace.endsWith('\n')) reject('INCOMPLETE_BUNDLE','trace.jsonl truncated (missing final newline)')
  const lines=trace.split('\n').filter(x=>x.length)
  if(lines.length>MAX_EVENTS)reject('UNSAFE_CONTENT','too many Trace events')
  const events=lines.map((line,index)=>{
    const ev=jsonStrict(line,'trace.jsonl#'+index)
    if(!keysExactly(ev,EVENT)||ev.sequence!==index||!Number.isSafeInteger(ev.sequence)||
       !STAGES.has(ev.stage)||typeof ev.kind!=='string'||!ev.kind.trim()||
       typeof ev.summary!=='string'||!ev.summary.trim()||!Array.isArray(ev.data))
      reject('INVALID_SHAPE','invalid v2 event at seq '+index)
    let previous=null
    for (const pair of ev.data) {
      if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||(previous!==null&&previous>=pair[0]))
        reject('INVALID_SHAPE','invalid sorted pair-array at seq '+index)
      previous=pair[0]
    }
    if(ev.material_ref!==null&&(typeof ev.material_ref!=='string'||!HASH.test(ev.material_ref)))
      reject('INVALID_SHAPE','invalid material reference at seq '+index)
    return {...ev,data:Object.fromEntries(ev.data)}
  })
  const refs=new Set(events.map(e=>e.material_ref).filter(Boolean))
  const filesOfMaterials=[...map.keys()].filter(k=>k.startsWith('materials/'))
  const available=new Set()
  for(const name of filesOfMaterials){
    const materialRef=name.slice('materials/'.length,-'.json'.length)
    const raw=await map.get(name).text()
    if(!raw.endsWith('\n'))reject('INVALID_SHAPE','non-writer material file '+name)
    const material=jsonStrict(raw,name)
    // Writer-format strictness: verify the exact bytes used by owner canonical_digest.
    // JS cannot generally reproduce Python float/escaping rules, so reject
    // ambiguous/noncanonical representations instead of claiming owner parity.
    const serialized=canonical(material)+'\n'
    if(raw!==serialized)reject('CANONICAL_UNSUPPORTED','material differs from canonical writer bytes: '+name)
    if(await digest(raw.slice(0,-1))!==materialRef)reject('DIGEST_MISMATCH',name)
    available.add(materialRef)
  }
  for(const ref of refs)if(!available.has(ref))reject('INCOMPLETE_BUNDLE','event references missing material '+ref)
  checkProcedure(events)
  const correlated=checkModel(events,meta)
  // Preserve occurrence order; group only contiguous events with the same stage.
  const sections=[]
  for(const ev of events){
    const prev=sections[sections.length-1]
    if(!prev||prev._stage!==ev.stage)
      sections.push({id:'native-section-'+ev.sequence,_stage:ev.stage,title:'SOURCE · '+ev.stage,
        subtitle:'Owner sequence starting at '+ev.sequence,kind:'native',records:[]})
    const refsHere=correlated.has(ev.sequence)?['ca-agent-demo:'+meta.run_id+':seq='+correlated.get(ev.sequence)]:[]
    sections[sections.length-1].records.push({
      ref:'ca-agent-demo:'+meta.run_id+':seq='+ev.sequence,
      sourceAuthority:'ca-agent-demo',ownerSequence:ev.sequence,
      kind:ev.kind,title:ev.kind,summary:ev.summary,status:eventKindStatus(ev.kind),
      causalRefs:refsHere,nativeData:ev.data,materialRef:ev.material_ref,
      sourceLocator:'trace.jsonl#sequence='+ev.sequence,stage:ev.stage
    })
  }
  const cleaned=sections.map(({_stage,...section})=>section)
  if(cleaned.length===0)cleaned.push({id:'native-empty',title:'SOURCE · Empty event stream',
    subtitle:'No persisted semantic events',kind:'native',records:[]})
  return {
    id:'native:'+meta.run_id,sourceKind:'NATIVE_LOCAL',mode:'NATIVE / AGENT DEMO',
    title:'TraceStore v2 · '+meta.run_id,subtitle:events.length+' native events · '+meta.spans.length+' timed spans',
    note:'Local files only. Structural and material digest checks passed; full ca-agent-demo TraceStore.load_run validation NOT performed. No native event timestamps are invented.',
    sections:cleaned,
    nativeMeta:{runId:meta.run_id,eventCount:events.length,materialCount:available.size,
      spanCount:meta.spans.length,sourceContract:'TraceStore/v2',ownerLoaderVerified:false,
      evidenceComplete:false,materialDirectoryPresence:'NOT_VERIFIABLE_WHEN_EMPTY'},
  }
}
