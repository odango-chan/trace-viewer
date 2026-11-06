/**
 * Read-only adapter for UNVERSIONED diagnostic JSONL exports, NOT TraceStore/v2.
 * This is a report projection: it does not recover owner-local sequence,
 * immutable material digests, complete Runtime event facts or replay authority.
 *
 * Drop data, diag, material and arbitrary summary immediately after shape check.
 * Nothing is uploaded or persisted; do not log imported source bytes.
 */
export class DiagnosticImportError extends Error {
  constructor(code, message) {
    super(code + ': ' + message)
    this.name = 'DiagnosticImportError'
    this.code = code
  }
}
const MAX_BYTES = 4 * 1024 * 1024
const MAX_ROWS = 10000
const EVENT_KEYS = ['data','diag','kind','material','summary']
const SPAN_KEYS = ['durationMs','endedAt','kind','name','stage','startedAt','status']
const STATUS_ALLOWED = new Set(['PASS','FAILED','BLOCKED','SUCCEEDED','COMMITTED','OUTCOME_UNKNOWN','RESULT_UNKNOWN','UNRESOLVED','SAFE_STOPPED'])
function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function exactKeys(v, keys) { return isPlain(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k)) }
function ensure(condition, code, message) { if (!condition) throw new DiagnosticImportError(code,message) }
function shortName(v) {
  if (typeof v !== 'string') return ''
  // This is local display of a trusted narrow field; never render arbitrary
  // diagnostic summary/material or internal payloads.
  return v.length <= 140 && !/[\r\n\u0000-\u001f]/.test(v) ? v : ''
}
function diagnosticStatus(record) {
  // Predicate/verification verdicts are observations, never Runtime terminal states.
  if (record.kind === 'PREDICATE_EVALUATED' || record.kind === 'VERIFY_RESULT') {
    const verdict = record.data?.verdict
    if (verdict === 'PASS' || verdict === 'FAIL' || verdict === 'UNKNOWN') return verdict
  }
  if (record.kind === 'span') {
    const status = String(record.status).replace(/^SpanStatus\./,'')
    return STATUS_ALLOWED.has(status) ? status : status === 'COMPLETED' ? 'COMPLETED' : 'RECORDED'
  }
  for (const v of [record.data?.verdict,record.data?.outcome,record.data?.terminal]) {
    if (typeof v === 'string' && STATUS_ALLOWED.has(v)) return v
  }
  return 'RECORDED'
}
export async function importReviewDiagnosticFile(file) {
  ensure(file && typeof file.name === 'string' && /\.jsonl$/i.test(file.name) &&
    typeof file.text === 'function' && Number.isSafeInteger(file.size) &&
    file.size > 0 && file.size <= MAX_BYTES,
    'UNSAFE_CONTENT','Select one bounded diagnostic JSONL file')
  const basename = file.name
  ensure(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(basename),'UNSAFE_CONTENT','Unsafe file name')
  const content = await file.text()
  ensure(typeof content === 'string' && content.length <= MAX_BYTES && content.endsWith('\n'),
    'INCOMPLETE_EXPORT','JSONL diagnostic must end with LF')
  const lines = content.split('\n')
  lines.pop()
  ensure(lines.length>0 && lines.length<=MAX_ROWS,'UNSAFE_CONTENT','Too many or no records')
  let spanCount=0,eventCount=0
  const sections=[]
  for (let i=0; i<lines.length;i++) {
    const line=lines[i]
    ensure(line.length>0,'INVALID_SHAPE','Empty JSONL record at line '+(i+1))
    let source
    try { source=JSON.parse(line) } catch { throw new DiagnosticImportError('INVALID_SHAPE','Invalid JSON at line '+(i+1)) }
    ensure(isPlain(source)&&typeof source.kind==='string'&&source.kind.length>0,
      'INVALID_SHAPE','Bad diagnostic record at line '+(i+1))
    const isSpan=source.kind==='span'
    if (isSpan){
      ensure(exactKeys(source,SPAN_KEYS)&&shortName(source.name)&&typeof source.stage==='string'&&
        typeof source.status==='string'&&typeof source.startedAt==='string'&&
        typeof source.endedAt==='string'&&typeof source.durationMs==='number'&&
        Number.isFinite(source.durationMs)&&source.durationMs>=0,
        'INVALID_SHAPE','Bad diagnostic span at line '+(i+1))
      spanCount++
    } else {
      ensure(exactKeys(source,EVENT_KEYS)&&isPlain(source.data)&&
        typeof source.summary==='string'&&typeof source.diag==='string'&&
        (source.material===null||isPlain(source.material))&&
        /^[A-Z][A-Z0-9_]{0,100}$/.test(source.kind),
        'INVALID_SHAPE','Bad diagnostic event at line '+(i+1))
      eventCount++
    }
    if(i%25===0)sections.push({
      id:'review-lines-'+(i+1),
      title:'REVIEW EXPORT · lines '+(i+1)+'–'+Math.min(lines.length,i+25),
      subtitle:'Diagnostic file ordering only · no native event sequence',
      kind:'review-export',records:[],
    })
    const kind=isSpan?'DIAGNOSTIC_SPAN':source.kind
    const status=diagnosticStatus(source)
    const title=isSpan ? (shortName(source.name)||'Timed diagnostic span') : kind
    sections[sections.length-1].records.push({
      ref:'review:'+basename+':line='+String(i+1),
      sourceAuthority:'ca-agent-demo:review-export',
      ownerSequence:null,
      sourceLine:i+1,
      kind,title,
      summary:isSpan?('Reported span duration: '+source.durationMs.toFixed(2)+' ms'):
        'Archived diagnostic event. Raw summary/material hidden by default.',
      status,causalRefs:[],
      stage:'RUNTIME',
      sourceLocator:basename+'#line='+String(i+1),
    })
    // source is discarded after this iteration. No material, diag, full data,
    // request snapshots or subscriber identifiers are returned to the UI.
  }
  return {
    id:'review:'+basename,sourceKind:'REVIEW_DIAGNOSTIC',
    mode:'DIAGNOSTIC / REVIEW EXPORT',
    title:'Archived diagnostic · '+basename,
    subtitle:lines.length+' report lines · '+spanCount+' spans / '+eventCount+' events',
    note:'Unversioned diagnostic export; not TraceStore v2 and not Runtime RunEvent.v1. Source file line is NOT an owner sequence. Raw material is withheld. Full native completeness and digest NOT VERIFIED.',
    sections,
    reviewMeta:{
      spanCount,eventCount,lineCount:lines.length,sourceContract:'UNVERSIONED_REVIEW_EXPORT',
      ownerLoaderVerified:false,evidenceComplete:false,materialCoverage:'NOT_VERIFIED',
      ownerSequence:'NOT_PRESENT',eventTimestamp:'NOT_PRESENT',
    },
  }
}
