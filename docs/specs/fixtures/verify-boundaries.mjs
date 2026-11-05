// Candidate Trace v0.2 synthetic boundary evaluator; no Producer or Consumer wire contract.

// Execute: node docs/specs/fixtures/verify-boundaries.mjs

import assert from "node:assert/strict";

import {readFileSync} from "node:fs";

const vectorsFile=JSON.parse(readFileSync(new URL("./unified-trace-v0.2-boundaries.json", import.meta.url),"utf8"));

const rt=(gateStatus,disposition,issueCodes=[],warnings=[],winnerRef=null)=>({gateStatus,disposition,issueCodes,warnings,winnerRef});

const sorted=x=>JSON.stringify(x,(_key,value)=>value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);

function assessIdentity(v){
 const {left,right}=v.input,oracle=v.oracle;
 if(!oracle.ownerNamespacesVerified) return rt("UNRESOLVED","IDENTITY_UNVERIFIABLE",["OWNER_NAMESPACE_UNVERIFIED"]);
 if(left.owner!==right.owner||left.recordRef!==right.recordRef)return rt("PASS","DISTINCT_FACTS");
 if(left.type!==right.type||left.typeVersion!==right.typeVersion)return rt("FAIL","IDENTITY_CONFLICT",["TYPE_VERSION_CHANGED"]);
 if(sorted(left.sourceTime)!==sorted(right.sourceTime))return rt("FAIL","IDENTITY_CONFLICT",["SOURCE_TIME_CHANGED"]);
 if(sorted(left.sourceDigest)!==sorted(right.sourceDigest))return rt("FAIL","IDENTITY_CONFLICT",["SOURCE_DIGEST_DESCRIPTOR_CHANGED"]);
 if(!oracle.canonicalizerRegistered)return rt("UNRESOLVED","IDENTITY_UNVERIFIABLE",["CANONICALIZER_MISSING"]);
 if(sorted(left.requiredContent)!==sorted(right.requiredContent))return rt("FAIL","IDENTITY_CONFLICT",["REQUIRED_CONTENT_CHANGED"]);
 if(!oracle.sourceDigestVerified)return rt("UNRESOLVED","IDENTITY_UNVERIFIABLE",["SOURCE_DIGEST_UNVERIFIED"]);
 const warnings=sorted(left.metadata)===sorted(right.metadata)?[]:["METADATA_DRIFT"];
 return rt("PASS","SAME_FACT",[],warnings);
}

function assessAdjudication(v){
 const {input,oracle}=v,ds=input.decisions;
 if(ds.some(d=>!d.ruleRef))return rt("UNRESOLVED","DISPUTED",["RULE_REFERENCE_MISSING"]);
 const refs=[...new Set(ds.map(d=>d.ruleRef))];
 if(refs.length!==1)return rt("UNRESOLVED","DISPUTED",["RULE_SELECTION_AMBIGUOUS"]);
 const rule=oracle.trustedRuleSnapshot.find(r=>r.recordRef===refs[0]);
 if(!rule||!oracle.publishedDecisionOrdersVerified||!rule.verifiedPublisher||rule.publisher!==oracle.allowedRulePublisher)return rt("UNRESOLVED","DISPUTED",["RULE_PUBLISHER_UNVERIFIED"]);
 if(rule.scope!==input.scope)return rt("UNRESOLVED","DISPUTED",["RULE_SCOPE_MISMATCH"]);
 const orders=ds.map(d=>oracle.trustedDecisionPublicationOrders?.[d.recordRef]);
 if(orders.some(x=>!Number.isInteger(x)))return rt("UNRESOLVED","DISPUTED",["DECISION_ORDER_UNVERIFIED"]);
 const first=Math.min(...orders);
 if(rule.publicationOrder>=first)return rt("UNRESOLVED","DISPUTED",["RULE_NOT_PREPUBLISHED"]);
 if(ds.some(d=>d.ruleVersion!==rule.ruleVersion))return rt("UNRESOLVED","DISPUTED",["RULE_VERSION_MISMATCH"]);
 if(orders.some(order=>rule.effectiveFromOrder>order||rule.effectiveUntilOrder<order))return rt("UNRESOLVED","DISPUTED",["RULE_NOT_EFFECTIVE"]);
 const scores=ds.map(d=>rule.rankByOwner[d.owner]);
 if(scores.some(x=>!Number.isInteger(x)))return rt("UNRESOLVED","DISPUTED",["RULE_SELECTION_AMBIGUOUS"]);
 const min=Math.min(...scores);
 if(scores.filter(s=>s===min).length!==1)return rt("UNRESOLVED","DISPUTED",["PRIORITY_TIE"]);
 const winner=ds[scores.indexOf(min)].recordRef;
 if(winner!==input.claimedWinnerRef)return rt("FAIL","MISADJUDICATED",["UNSUPPORTED_WINNER"],[],winner);
 return rt("PASS","RESOLVED",[],[],winner);
}

function assessProjection(v){
 const p=v.input.projection,s=v.oracle.trustedSourceSnapshot;
 for(const k of ["recordRef","owner","type","typeVersion","sourceTime"]){if(sorted(p[k])!==sorted(s[k]))return rt("FAIL","SOURCE_IDENTITY_CHANGED",["SOURCE_IDENTITY_CHANGED"]);}
 if(p.sourceDigestState==="PRESERVED"){
   if(sorted(p.sourceDigest)!==sorted(s.sourceDigest))return rt("FAIL","SOURCE_DIGEST_CHANGED",["SOURCE_DIGEST_DESCRIPTOR_CHANGED"]);
   return rt("PASS","PRESERVED");
 }
 if(p.sourceDigestState==="REDACTED_BY_POLICY"){
   const e=v.oracle.retentionProof;
   if(!e||!e.verified)return rt("UNRESOLVED","REDACTED_UNVERIFIED",["RETENTION_PROOF_MISSING"]);
   if(e.sourceRef!==s.recordRef||e.policyRef!==p.redactionPolicyRef||!e.viewerDenied||!e.digestMatches)return rt("FAIL","FALSE_REDACTION_CLAIM",["SOURCE_NOT_PRESERVED"]);
   return rt("PASS","REDACTED_VERIFIED");
 }
 if(p.sourceDigestState==="OMITTED"){
   if(p.lossy===true&&p.knownLosses?.includes("sourceDigest"))return rt("PASS","LOSSY_DECLARED");
   return rt("FAIL","LOSS_UNDECLARED",["OMITTED_WITHOUT_LOSS_DECLARATION"]);
 }
 return rt("FAIL","LOSS_UNDECLARED",["OMITTED_WITHOUT_LOSS_DECLARATION"]);
}

function assess(v){switch(v.kind){case "IDENTITY":return assessIdentity(v);case "ADJUDICATION":return assessAdjudication(v);case "PROJECTION":return assessProjection(v);default:throw Error(`Unknown kind ${v.kind}`);}}

assert.equal(vectorsFile.authority,"SYNTHETIC_HARNESS_ORACLE_NOT_PRODUCER_WIRE_SCHEMA");

const cases=vectorsFile.vectors;

assert.equal(new Set(cases.map(v=>v.id)).size,cases.length,"Duplicate vector ids");

let passed=0;

for(const v of cases){assert.ok(v.id&&v.kind&&v.input&&v.oracle&&v.expected,`Incomplete vector ${v.id}`);assert.deepEqual(assess(v),v.expected,`Vector ${v.id}`);passed++;}

console.log(`BOUNDARY_FIXTURES_PASS ${passed}/${cases.length} (synthetic semantic oracle; NOT cross-implementation conformance)`);

