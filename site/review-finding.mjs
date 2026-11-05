/**
 * Local-only adapter for an unversioned, standalone diagnostic finding report.
 *
 * It is NOT an Owner event, Run, TraceStore record, causal edge or evidence
 * certificate. The public Viewer must never infer a join to the selected Run.
 * Only bounded, allowlisted, source-asserted metadata leaves this function.
 */
export class ReviewFindingError extends Error {
  constructor(code, message) {
    super(code + ': ' + message)
    this.name = 'ReviewFindingError'
    this.code = code
  }
}

const MAX_BYTES = 64 * 1024
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.json$/
const SAFE_TEXT = /^[A-Za-z0-9 _.,:;()=+\/-]{1,240}$/
const SENSITIVE = /(?:supi|imsi|imei|msisdn|gpsi|subscriber|authorization|bearer|password|passwd|secret|token|api[_-]?key|cookie|session[_-]?key|private|identity[_-]?document|\b[a-f0-9]{32,}\b|\b\d{5,}\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i
const REQUIRED = ['owner','outcome','firstFailureStage','firstFailureNode','predicate','ownerResult','networkEffect']
const OPTIONAL = new Set(['attempt2Observation','bindingsSupplied','fix','ownerComponents','rootCause','spanDurationMs'])
function object(v) { return v!==null && typeof v==='object' && !Array.isArray(v) }
function fail(code, reason) { throw new ReviewFindingError(code, reason) }

function safeText(value) {
  if (typeof value!=='string' || !value.trim() || value.length>240 ||
      !SAFE_TEXT.test(value) || SENSITIVE.test(value)) return null
  return value
}

export async function importReviewFindingFile(file) {
  if (!file || typeof file.name!=='string' || !SAFE_LABEL.test(file.name) ||
      !Number.isSafeInteger(file.size) || file.size<=0 || file.size>MAX_BYTES ||
      typeof file.text!=='function') fail('UNSAFE_CONTENT','Select one bounded local .json diagnosis report')
  const bytes=await file.text()
  if(typeof bytes!=='string' || bytes.length>MAX_BYTES) fail('UNSAFE_CONTENT','Diagnosis is too large')
  let source
  try { source=JSON.parse(bytes) }
  catch { fail('INVALID_SHAPE','Invalid report JSON') }
  if(!object(source) || !REQUIRED.every(key=>Object.hasOwn(source,key)) ||
      !Object.keys(source).every(key=>REQUIRED.includes(key)||OPTIONAL.has(key)) ||
      !object(source.ownerResult)) fail('INVALID_SHAPE','Unsupported standalone diagnosis report')

  const fields=[
    ['Reported owner',source.owner],
    ['Reported outcome',source.outcome],
    ['First failure stage',source.firstFailureStage],
    ['First failure node',source.firstFailureNode],
    ['Predicate',source.predicate],
    ['Reported wait reason',source.ownerResult.reason],
    ['Reported network effect',source.networkEffect],
    ['Reported scope correction',object(source.fix)?source.fix.waitScope:undefined],
    ['Reported binding correction',object(source.fix)?source.fix.procedureBindings:undefined],
  ].map(([label,value])=>({label,value:safeText(value)})).filter(row=>row.value!==null)

  if(fields.length<5 || !safeText(source.firstFailureNode) ||
      !safeText(source.ownerResult.reason) ||
      !safeText(source.firstFailureStage)) {
    fail('INVALID_SHAPE','Missing safe failure-location metadata')
  }

  const observationsUsed=source.ownerResult.observationsUsed
  if(Number.isSafeInteger(observationsUsed) && observationsUsed>=0 && observationsUsed<=10000)
    fields.push({label:'Reported observations used',value:String(observationsUsed)})

  let bindingNames=[]
  if(object(source.bindingsSupplied)){
    const names=Object.keys(source.bindingsSupplied)
    if(names.length<=16 && names.every(name=>/^[A-Za-z][A-Za-z0-9_]{0,64}$/.test(name)))
      bindingNames=names.slice().sort()
  }
  return {
    sourceKind:'REVIEW_FINDING',
    title:'Standalone diagnostic finding',
    sourceLocator:file.name,
    sourceAuthority:'UNVERSIONED_REVIEW_REPORT',
    fields, bindingNames,
    suppressedOriginalText:!!source.rootCause,
    ownerSequence:null,
    runAssociation:'NOT_ESTABLISHED',
    evidenceIntegrity:'NOT_VERIFIED',
  }
}
