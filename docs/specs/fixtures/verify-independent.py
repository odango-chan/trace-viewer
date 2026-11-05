#!/usr/bin/env python3
"""Independent Python assessor for SYNTHETIC Trace v0.2 fixtures, not Owner conformance."""
import copy
import json
import sys
from pathlib import Path

def result(status, disposition, *issues, warnings=(), winner=None):
    return dict(gateStatus=status, disposition=disposition, issueCodes=list(issues),
                warnings=list(warnings), winnerRef=winner)

def p0(status, coverage="N_A", product="N_A", *issues):
    return dict(gateStatus=status, coverage=coverage, productStatus=product,
                issueCodes=list(issues))

def equivalent_ids(a, b):
    return (isinstance(a, list) and isinstance(b, list) and len(a) == len(b)
            and len(set(a)) == len(a) and set(a) == set(b))

def identity(c):
    a, b = c["input"]["left"], c["input"]["right"]
    o = c["oracle"]
    if not o.get("ownerNamespacesVerified"):
        return result("UNRESOLVED", "IDENTITY_UNVERIFIABLE", "OWNER_NAMESPACE_UNVERIFIED")
    if (a["owner"], a["recordRef"]) != (b["owner"], b["recordRef"]):
        return result("PASS", "DISTINCT_FACTS")
    if (a["type"], a["typeVersion"]) != (b["type"], b["typeVersion"]):
        return result("FAIL", "IDENTITY_CONFLICT", "TYPE_VERSION_CHANGED")
    if a["sourceTime"] != b["sourceTime"]:
        return result("FAIL", "IDENTITY_CONFLICT", "SOURCE_TIME_CHANGED")
    if a["sourceDigest"] != b["sourceDigest"]:
        return result("FAIL", "IDENTITY_CONFLICT", "SOURCE_DIGEST_DESCRIPTOR_CHANGED")
    if not o.get("canonicalizerRegistered"):
        return result("UNRESOLVED", "IDENTITY_UNVERIFIABLE", "CANONICALIZER_MISSING")
    if a["requiredContent"] != b["requiredContent"]:
        return result("FAIL", "IDENTITY_CONFLICT", "REQUIRED_CONTENT_CHANGED")
    if not o.get("sourceDigestVerified"):
        return result("UNRESOLVED", "IDENTITY_UNVERIFIABLE", "SOURCE_DIGEST_UNVERIFIED")
    note = ("METADATA_DRIFT",) if a.get("metadata") != b.get("metadata") else ()
    return result("PASS", "SAME_FACT", warnings=note)

def adjudicate(c):
    facts, o = c["input"]["decisions"], c["oracle"]
    if any(not d.get("ruleRef") for d in facts):
        return result("UNRESOLVED", "DISPUTED", "RULE_REFERENCE_MISSING")
    refs = {d["ruleRef"] for d in facts}
    if len(refs) != 1:
        return result("UNRESOLVED", "DISPUTED", "RULE_SELECTION_AMBIGUOUS")
    rules = [r for r in o["trustedRuleSnapshot"] if r["recordRef"] in refs]
    if len(rules) != 1 or not o.get("publishedDecisionOrdersVerified"):
        return result("UNRESOLVED", "DISPUTED", "RULE_PUBLISHER_UNVERIFIED")
    r = rules[0]
    if not r.get("verifiedPublisher") or r["publisher"] != o["allowedRulePublisher"]:
        return result("UNRESOLVED", "DISPUTED", "RULE_PUBLISHER_UNVERIFIED")
    if r["scope"] != c["input"]["scope"]:
        return result("UNRESOLVED", "DISPUTED", "RULE_SCOPE_MISMATCH")
    order = o.get("trustedDecisionPublicationOrders", {})
    stamps = [order.get(d["recordRef"]) for d in facts]
    if any(type(t) is not int for t in stamps):
        return result("UNRESOLVED", "DISPUTED", "DECISION_ORDER_UNVERIFIED")
    if r["publicationOrder"] >= min(stamps):
        return result("UNRESOLVED", "DISPUTED", "RULE_NOT_PREPUBLISHED")
    if any(d.get("ruleVersion") != r["ruleVersion"] for d in facts):
        return result("UNRESOLVED", "DISPUTED", "RULE_VERSION_MISMATCH")
    if any(not r["effectiveFromOrder"] <= t <= r["effectiveUntilOrder"] for t in stamps):
        return result("UNRESOLVED", "DISPUTED", "RULE_NOT_EFFECTIVE")
    ranks = [r["rankByOwner"].get(d["owner"]) for d in facts]
    if any(type(rank) is not int for rank in ranks):
        return result("UNRESOLVED", "DISPUTED", "RULE_SELECTION_AMBIGUOUS")
    lowest = min(ranks)
    if ranks.count(lowest) != 1:
        return result("UNRESOLVED", "DISPUTED", "PRIORITY_TIE")
    winner = facts[ranks.index(lowest)]["recordRef"]
    if winner != c["input"]["claimedWinnerRef"]:
        return result("FAIL", "MISADJUDICATED", "UNSUPPORTED_WINNER", winner=winner)
    return result("PASS", "RESOLVED", winner=winner)

def projection(c):
    a, b = c["input"]["projection"], c["oracle"]["trustedSourceSnapshot"]
    if any(a.get(field) != b.get(field) for field in
           ("recordRef", "owner", "type", "typeVersion", "sourceTime")):
        return result("FAIL", "SOURCE_IDENTITY_CHANGED", "SOURCE_IDENTITY_CHANGED")
    state = a.get("sourceDigestState")
    if state == "PRESERVED":
        if a.get("sourceDigest") != b["sourceDigest"]:
            return result("FAIL", "SOURCE_DIGEST_CHANGED", "SOURCE_DIGEST_DESCRIPTOR_CHANGED")
        return result("PASS", "PRESERVED")
    if state == "REDACTED_BY_POLICY":
        proof = c["oracle"].get("retentionProof")
        if not proof or not proof.get("verified"):
            return result("UNRESOLVED", "REDACTED_UNVERIFIED", "RETENTION_PROOF_MISSING")
        if (proof.get("sourceRef") == b["recordRef"] and
            proof.get("policyRef") == a.get("redactionPolicyRef") and
            proof.get("viewerDenied") is True and proof.get("digestMatches") is True):
            return result("PASS", "REDACTED_VERIFIED")
        return result("FAIL", "FALSE_REDACTION_CLAIM", "SOURCE_NOT_PRESERVED")
    if state == "OMITTED" and a.get("lossy") is True and "sourceDigest" in a.get("knownLosses", []):
        return result("PASS", "LOSSY_DECLARED")
    return result("FAIL", "LOSS_UNDECLARED", "OMITTED_WITHOUT_LOSS_DECLARATION")

def product(c):
    obj, trusted = c["input"], c["oracle"]
    profile, source = obj["profile"], trusted.get("trustedSourceScope", {})
    published = trusted.get("trustedProfilePublication", {})
    if not (published.get("verifiedPreEvaluation") is True and
            published.get("ref") == profile["recordRef"] and
            published.get("profileVersion") == profile["profileVersion"] and
            published.get("scopeMatched") is True):
        return p0("UNRESOLVED", source.get("coverage", "UNKNOWN"), "UNRESOLVED",
                  "PROFILE_PUBLICATION_UNVERIFIED")
    expected = source["interactionIds"]
    actual = [d["id"] for d in obj["evidence"]["modelInteractions"]]
    complete = (source["coverage"] == "COMPLETE" and source["scope"] == profile["scope"]
                and equivalent_ids(expected, actual))
    proof = trusted["trustedMaterialsByInteraction"]
    recoverable = all(all(proof.get(i, {}).get(part) == "VERIFIED" for part in
                          ("request", "responseOrError", "effectiveMaterials")) for i in expected)
    if complete and recoverable and "AGENT_L0" in profile["requiredCapabilities"]:
        return p0("PASS", "COMPLETE", "PASS")
    coverage = ("COMPLETE" if source["coverage"] == "COMPLETE" and equivalent_ids(expected, actual)
                else "PARTIAL" if source["coverage"] == "COMPLETE" else "UNKNOWN")
    return p0("FAIL", coverage, "TARGET_GAP", "REQUIRED_CAPABILITY_MISSING")

def scope(c):
    o, declared = c["oracle"], c["input"]
    source = o["trustedSourceScope"]
    full = (source["coverage"] == "COMPLETE" and
            equivalent_ids(source["interactionIds"], declared["capturedModelInteractionIds"]))
    proof = o["trustedMaterialsByInteraction"]
    verified = all(all(proof.get(i, {}).get(k) == "VERIFIED" for k in
                       ("request", "responseOrError", "effectiveMaterials"))
                   for i in source["interactionIds"])
    coverage = "UNKNOWN" if source["coverage"] == "UNKNOWN" else "COMPLETE" if full else "PARTIAL"
    if full and verified:
        return p0("PASS", "COMPLETE")
    if declared.get("claimedScopeL0") == "PASS":
        return p0("FAIL", coverage, "N_A", "UNSUPPORTED_SCOPE_PASS")
    return p0("UNRESOLVED", coverage)

def interaction(c):
    stages = c["input"]["interaction"]["stages"]
    role = {s["stage"] for s in stages}
    locators = {s["locator"] for s in stages}
    delivered = next((s for s in stages if s["stage"] == "delivery"), None)
    dispatch = c["oracle"]["trustedModelDispatch"]
    if not (len(stages) == len(locators) == 3 and role == {"request", "result", "delivery"}
            and delivered and delivered.get("materialRef")
            and dispatch["verifiedEffectiveRequest"] is True and
            equivalent_ids(dispatch["consumedMaterialRefs"],
                           c["input"]["outboundModelRequest"]["declaredConsumes"])):
        return p0("FAIL", "N_A", "N_A", "MATERIAL_ROLE_MISMATCH")
    return p0("PASS")

def predicate(c):
    fact, trust = c["input"]["fact"], c["oracle"]
    obs = trust["trustedObservation"]
    if not (f"{fact['type']}@{fact['typeVersion']}" in trust["allowedTypes"] and
            obs["status"] == "UNAVAILABLE" and obs["sourceVerified"] is True and
            fact.get("observedStatus") == "UNAVAILABLE" and fact.get("unavailableReason") and
            fact["verdict"] == "UNKNOWN" and "observedValue" not in fact):
        return p0("FAIL", "N_A", "N_A", "INVALID_PREDICATE_VERDICT")
    return p0("PASS")

CHECKERS = {"IDENTITY": identity, "ADJUDICATION": adjudicate, "PROJECTION": projection,
            "P0-1": product, "P0-2": scope, "P0-3": interaction, "P0-4": predicate}

def assess(c):
    return CHECKERS[c.get("kind", c.get("p0"))](c)

def run(folder):
    cases = [c for filename in ("unified-trace-v0.2-p0.json", "unified-trace-v0.2-boundaries.json")
             for c in json.loads((folder / filename).read_text(encoding="utf8"))["vectors"]]
    names = [c["id"] for c in cases]
    if len(names) != len(set(names)):
        raise ValueError("duplicate fixture ID")
    errors = []
    for c in cases:
        actual = assess(c)
        if actual != c["expected"]:
            errors.append((c["id"], actual, c["expected"]))
    if errors:
        for item in errors: print("MISMATCH", item, file=sys.stderr)
        raise ValueError(f"{len(errors)}/{len(cases)} semantic disagreements")
    print(f"INDEPENDENT_PYTHON_SYNTHETIC_PASS {len(cases)}/{len(cases)}")
    items = {c["id"]: c for c in cases}
    mutations = [
        ("I01-idempotent", lambda c: c["input"]["right"].update(typeVersion="v9"),
         lambda verdict: verdict["disposition"] == "IDENTITY_CONFLICT"),
        ("A01-preregistered-authorized",
         lambda c: c["oracle"]["trustedRuleSnapshot"][0].update(publicationOrder=500),
         lambda verdict: verdict["disposition"] == "DISPUTED"),
        ("R02-redacted-with-proof",
         lambda c: c["oracle"]["retentionProof"].update(digestMatches=False),
         lambda verdict: verdict["disposition"] == "FALSE_REDACTION_CLAIM"),
        ("P0-1-positive",
         lambda c: c["oracle"]["trustedProfilePublication"].update(verifiedPreEvaluation=False),
         lambda verdict: verdict["productStatus"] == "UNRESOLVED"),
    ]
    for name, alter, verify in mutations:
        copy_of_case = copy.deepcopy(items[name])
        alter(copy_of_case)
        if not verify(assess(copy_of_case)):
            raise ValueError(f"metamorphic check failed: {name}")
    print(f"INDEPENDENT_PYTHON_METAMORPHIC_PASS {len(mutations)}/{len(mutations)}")

if __name__ == "__main__":
    try:
        run(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent)
    except (ValueError, KeyError, AssertionError, TypeError) as err:
        print(f"INDEPENDENT_PYTHON_FAIL: {err}", file=sys.stderr)
        sys.exit(1)
