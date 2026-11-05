// Synthetic semantic test assessor. This is not the official cross-Owner wire Schema.

// Execute: node docs/specs/fixtures/verify-p0.mjs

import assert from "node:assert/strict";

import {readFileSync} from "node:fs";

const vectorsFile=JSON.parse(readFileSync(new URL("./unified-trace-v0.2-p0.json",import.meta.url),"utf8"));

const result=(gateStatus,coverage="N_A",productStatus="N_A",issueCodes=[])=>({gateStatus,coverage,productStatus,issueCodes});

function sameSet(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));}

function assessProduct(v){
  const profile=v.input.profile,publication=v.oracle.trustedProfilePublication,scope=v.oracle.trustedSourceScope;
  if(!publication||!publication.verifiedPreEvaluation||publication.ref!==profile.recordRef||publication.profileVersion!==profile.profileVersion||!publication.scopeMatched){
    return result("UNRESOLVED",scope?.coverage||"UNKNOWN","UNRESOLVED",["PROFILE_PUBLICATION_UNVERIFIED"]);
  }
  const expected=scope.interactionIds,actual=v.input.evidence.modelInteractions.map(i=>i.id);
  const validScope=scope.coverage==="COMPLETE"&&scope.scope===profile.scope&&sameSet(expected,actual);
  const materialsOk=expected.every(id=>{
    const x=v.oracle.trustedMaterialsByInteraction[id];
    return x?.request==="VERIFIED"&&x.responseOrError==="VERIFIED"&&x.effectiveMaterials==="VERIFIED";
  });
  if(validScope&&materialsOk&&profile.requiredCapabilities.includes("AGENT_L0"))return result("PASS","COMPLETE","PASS");
  return result("FAIL",scope.coverage==="COMPLETE"&&sameSet(expected,actual)?"COMPLETE":scope.coverage==="COMPLETE"?"PARTIAL":"UNKNOWN","TARGET_GAP",["REQUIRED_CAPABILITY_MISSING"]);
}

function assessScope(v){
 const scope=v.oracle.trustedSourceScope,captured=v.input.capturedModelInteractionIds;
 const complete=scope.coverage==="COMPLETE"&&sameSet(scope.interactionIds,captured);
 const materialOk=scope.interactionIds.every(id=>{
    const x=v.oracle.trustedMaterialsByInteraction[id];
    return x?.request==="VERIFIED"&&x.responseOrError==="VERIFIED"&&x.effectiveMaterials==="VERIFIED";
 });
 const coverage=scope.coverage==="UNKNOWN"?"UNKNOWN":complete?"COMPLETE":"PARTIAL";
 if(complete&&materialOk)return result("PASS","COMPLETE");
 if(v.input.claimedScopeL0==="PASS")return result("FAIL",coverage,"N_A",["UNSUPPORTED_SCOPE_PASS"]);
 return result("UNRESOLVED",coverage);
}

function assessInteraction(v){
 const stages=v.input.interaction.stages;
 const hasPreciseStages=stages.length===3&&new Set(stages.map(s=>s.locator)).size===3&&["request","result","delivery"].every(name=>stages.some(s=>s.stage===name));
 const d=stages.find(s=>s.stage==="delivery");
 const oracle=v.oracle.trustedModelDispatch;
 if(!hasPreciseStages||!d?.materialRef||!oracle.verifiedEffectiveRequest||!sameSet(oracle.consumedMaterialRefs,v.input.outboundModelRequest.declaredConsumes)){
    return result("FAIL","N_A","N_A",["MATERIAL_ROLE_MISMATCH"]);
 }
 return result("PASS");
}

function assessPredicate(v){
 const fact=v.input.fact,oracle=v.oracle;
 const typeAllowed=oracle.allowedTypes.includes(`${fact.type}@${fact.typeVersion}`);
 const unavailable=oracle.trustedObservation.status==="UNAVAILABLE";
 if(!typeAllowed||!oracle.trustedObservation.sourceVerified||!unavailable||fact.observedStatus!=="UNAVAILABLE"||!fact.unavailableReason||fact.verdict!=="UNKNOWN"||Object.hasOwn(fact,"observedValue")){
  return result("FAIL","N_A","N_A",["INVALID_PREDICATE_VERDICT"]);
 }
 return result("PASS");
}

function assessP0(v){switch(v.p0){case "P0-1":return assessProduct(v);case "P0-2":return assessScope(v);case "P0-3":return assessInteraction(v);case "P0-4":return assessPredicate(v);default:throw Error("Unknown P0 "+v.p0);}}

assert.ok(vectorsFile.authority.includes("NOT_PRODUCER_WIRE_SCHEMA"));

assert.equal(new Set(vectorsFile.vectors.map(v=>v.id)).size,vectorsFile.vectors.length);

let pass=0;

for(const v of vectorsFile.vectors){assert.ok(v.input&&v.oracle&&v.expected,`Missing evidence in ${v.id}`);assert.deepEqual(assessP0(v),v.expected,`P0 ${v.id}`);pass++;}

console.log(`P0_FIXTURES_PASS ${pass}/${vectorsFile.vectors.length} (synthetic semantic oracle; NOT independent conformance)`);

