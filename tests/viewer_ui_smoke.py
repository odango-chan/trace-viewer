#!/usr/bin/env python3
"""Synthetic-only browser smoke of the actual Trace Viewer UI, not Phoenix."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("VIEWER_URL", "http://127.0.0.1:8123")
OUT = Path(os.environ.get("VIEWER_UI_PROOF_DIR", "/tmp/viewer-ui-proof"))
OUT.mkdir(parents=True, exist_ok=True)


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        try:
            page.goto(URL, wait_until="domcontentloaded", timeout=30000)
            page.get_by_text("SYNTHETIC DATA", exact=True).wait_for(timeout=20000)
            checks.append("App loads and synthetic provenance visible")
            picker = page.get_by_role("combobox", name="Choose demo example")
            assert picker.is_visible()
            assert picker.input_value() == "synthetic-agent-recovery"
            assert picker.locator("option").count() == 5
            assert page.locator(".run-list .run-option").count() == 0
            assert page.locator(".run-empty").is_visible()
            assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()") == "#0c8e7b"
            checks.append("Studio teal tokens and bottom-left synthetic example picker visible")
            surfaces = page.evaluate("""() => Object.fromEntries(
                ['.topbar', '.sidebar', '.canvas', '.inspector', '.turn-card', '.turn-header', '.turn-body']
                  .map(selector => [selector, getComputedStyle(document.querySelector(selector)).backgroundColor])
            )""")
            assert surfaces[".sidebar"] == "rgb(255, 255, 255)"
            assert surfaces[".canvas"] == "rgb(245, 247, 251)"
            assert surfaces[".inspector"] == "rgb(255, 255, 255)"
            assert surfaces[".turn-card"] == "rgb(255, 255, 255)"
            assert surfaces[".turn-header"] == "rgb(251, 252, 254)"
            assert len(set(surfaces.values())) >= 3
            assert surfaces[".canvas"] != surfaces[".turn-card"]
            assert surfaces[".turn-header"] != surfaces[".turn-body"]
            assert surfaces[".topbar"] == "rgb(255, 255, 255)"
            assert page.locator(".brand-copy strong").evaluate(
                "(node) => getComputedStyle(node).color") == "rgb(35, 53, 80)"
            assert page.locator(".sidebar-caption").first.evaluate(
                "(node) => getComputedStyle(node).color") == "rgb(116, 139, 165)"
            assert surfaces[".turn-body"] == surfaces[".turn-card"]
            checks.append("Skill Studio light palette restored without breaking dense trace rows")
            assert page.get_by_text("Source records", exact=True).is_visible()
            assert page.get_by_text("Source authorities", exact=True).is_visible()
            assert page.locator(".metric").first.bounding_box()["height"] <= 58
            assert page.locator(".timeline").bounding_box()["y"] < 450
            page.locator(".turn-card .turn-header").first.click()
            assert page.locator(".timeline .event-kind").first.is_visible()
            assert "MODEL_" in page.locator(".timeline .event-kind").first.inner_text()
            checks.append("Compact above-fold trajectory retains explicit source kinds and accurate totals")
            assert page.locator(".ledger-view").count() >= 1
            assert page.locator(".owner-lane").count() == 0
            assert page.locator(".ledger-head").first.is_visible()
            assert page.locator(".ledger-event .ledger-kind").filter(has_text="Model Interaction").count() >= 1
            assert "synthetic:agent" in page.locator(".ledger-event .ledger-authority").first.inner_text()
            assert "synthetic:model-req-1" in page.locator(".ledger-event .ledger-ref").first.inner_text()
            assert page.locator(".ledger-event .event-side").first.is_visible()
            checks.append("Readable source ledger shows folded interaction, authority, exact ref, status and position")
            page.get_by_role("button", name="All owners", exact=True).click()
            assert page.locator(".owner-lane").count() >= 4
            assert page.locator(".ledger-view").count() == 0
            checks.append("All owners retains separate Agent/Runtime/Fabric/World lanes")
            page.get_by_role("button", name="Raw records", exact=True).click()
            assert "synthetic:model-req-1" in page.locator(".timeline").inner_text()
            page.locator(".turn-card .trace-event").first.click()
            page.get_by_role("button", name="Source", exact=True).click()
            assert '"sourceKind": "SYNTHETIC"' in page.locator(".source-preview").inner_text()
            checks.append("Raw records and Inspector source refs preserve original identity")

            page.get_by_role("combobox", name="Choose demo example").select_option(label="Delivery failure · Host RESULT_UNKNOWN")
            page.get_by_role("button", name="Focus unknown").click()
            assert page.locator(".inspector-title").inner_text() == "Host delivery interrupted"
            assert "RESULT_UNKNOWN" in page.locator(".inspector").inner_text()
            page.get_by_role("button", name="All", exact=True).click()
            page.get_by_role("button", name="Readable", exact=True).click()
            assert "Runtime SUCCEEDED" in page.locator(".timeline").inner_text()
            checks.append("Host RESULT_UNKNOWN distinct from Runtime SUCCEEDED")
            page.get_by_role("button", name="Collapse normal").click()
            page.get_by_role("button", name="Locate selected").click()
            assert page.get_by_role("button", name="Raw records", exact=True).get_attribute("aria-pressed") == "true"
            assert page.locator(".timeline .trace-event.selected").count() == 1
            checks.append("Locate selected reveals collapsed source and selects its exact raw row")

            page.get_by_role("combobox", name="Choose demo example").select_option(label="Parallel reads · out-of-order ToolResults")
            page.locator(".turn-card .turn-header").first.click()
            assert page.locator(".ledger-event .ledger-kind").filter(has_text="Tool Interaction").count() == 2
            page.get_by_text("query_session (A)", exact=True).click()
            assert page.locator(".paired-sources button").count() == 2
            page.locator(".paired-sources button").nth(1).click()
            assert "synthetic:parallel-result-a" in page.locator(".source-preview").inner_text()
            checks.append("Two out-of-order ToolResults pair by exact call ref")

            page.get_by_role("combobox", name="Choose demo example").select_option(label="Frozen Procedure · without a model call")
            page.get_by_role("button", name="Model only", exact=True).click()
            assert page.locator(".timeline .empty-state").count() == 1
            page.get_by_role("button", name="All owners", exact=True).click()
            assert page.locator(".timeline .turn-card").count() >= 2
            checks.append("Deterministic Run does not fabricate a Model interaction")

            # Synthetic-only local diagnostic V1: no private Owner data enters this test.
            examples = [
                {
                    "kind": "PREDICATE_EVALUATED",
                    "data": {
                        "predicate_identity": "ran_response_received",
                        "verdict": "UNKNOWN",
                        "reason": "Await selector did not match",
                        "evidence_refs": ["synthetic-private-ref"],
                        "subscriber": "imsi-synthetic-private",
                    },
                    "material": {"output": {"token": "synthetic-hidden-material"}},
                    "summary": "synthetic-hidden-summary",
                    "diag": "synthetic-hidden-diagnostic",
                },
                {
                    "kind": "CALL_RESULT",
                    "data": {
                        "operation": "smf.create_context",
                        "reported_outcome": "COMMITTED",
                        "outcome": "COMMITTED",
                        "bindings": {"token": "synthetic-hidden-binding"},
                    },
                    "material": None,
                    "summary": "synthetic-hidden-call-summary",
                    "diag": "synthetic-hidden-call-diagnostic",
                },
                {
                    "kind": "VERIFY_RESULT",
                    "data": {"scope": "ROOT", "verdict": "FAIL", "reason": None},
                    "material": None,
                    "summary": "synthetic-hidden-verify-summary",
                    "diag": "synthetic-hidden-verify-diagnostic",
                },
            ]
            payload = (chr(10).join(json.dumps(x) for x in examples) + chr(10)).encode("utf-8")
            page.locator("#review-jsonl").set_input_files({
                "name": "synthetic-v1-diagnostic.jsonl",
                "mimeType": "application/x-ndjson",
                "buffer": payload,
            })
            page.get_by_text("ARCHIVED DIAGNOSTIC · NOT OWNER NATIVE", exact=True).wait_for()
            assert page.locator(".inspector-title").inner_text() == "PREDICATE_EVALUATED"
            assert page.locator(".inspector .status.uncertain").inner_text() == "UNKNOWN"
            page.get_by_role("button", name="Show allowed local fields").click()
            page.get_by_text("Await selector did not match", exact=True).wait_for(timeout=10000)
            detail = page.locator(".local-detail")
            assert "Await selector did not match" in detail.inner_text()
            for secret in ("imsi-synthetic-private", "synthetic-hidden-material",
                           "synthetic-hidden-summary", "synthetic-private-ref"):
                assert secret not in page.locator(".app-shell").inner_text()
            checks.append("Explicit local detail reveals only allowed fields, no raw materials")

            page.get_by_role("button", name="Focus unknown").click()
            assert page.locator(".local-detail-fields").count() == 0
            assert page.locator(".inspector .status.uncertain").inner_text() == "UNKNOWN"
            checks.append("Focus unknown finds Predicate without treating it as terminal failure")

            page.get_by_role("button", name="Source", exact=True).click()
            assert '"sourceLine": 1' in page.locator(".source-preview").inner_text()
            assert page.get_by_role("button", name="Previous line", exact=True).is_disabled()
            page.get_by_role("button", name="Next line · 2", exact=True).click()
            assert '"sourceLine": 2' in page.locator(".source-preview").inner_text()
            page.get_by_role("button", name="Previous line · 1", exact=True).click()
            assert '"sourceLine": 1' in page.locator(".source-preview").inner_text()
            assert "does not establish causality" in page.locator(".review-line-context").inner_text()
            checks.append("Source Inspector traverses physical file neighbors, never inferred causal refs")

            page.get_by_role("button", name="Summary", exact=True).click()
            context = page.get_by_role("region", name="Reading context")
            assert "1 / 3 in section" in context.inner_text()
            assert "not causal" in context.inner_text()
            assert page.get_by_role("button", name="Previous record", exact=True).is_disabled()
            page.get_by_role("button", name="Next record", exact=True).click()
            assert page.locator(".inspector-title").inner_text() == "CALL_RESULT"
            page.get_by_role("button", name="Back to prior source", exact=True).click()
            assert page.locator(".inspector-title").inner_text() == "PREDICATE_EVALUATED"
            assert page.get_by_role("button", name="Back to prior source", exact=True).is_disabled()
            checks.append("Reading context navigates one section and returns to prior source")

            page.get_by_role("button", name="All", exact=True).click()
            page.locator(".timeline .trace-event").filter(has_text="CALL_RESULT").first.click()
            assert page.locator(".local-detail-fields").count() == 0
            page.get_by_role("button", name="Show allowed local fields").click()
            page.get_by_text("smf.create_context", exact=True).wait_for(timeout=10000)
            assert "smf.create_context" in page.locator(".local-detail").inner_text()
            assert "synthetic-hidden-binding" not in page.locator(".app-shell").inner_text()
            page.get_by_role("combobox", name="Choose demo example").select_option(label="Frozen Procedure · without a model call")
            assert page.locator(".local-detail").count() == 0
            checks.append("Changing selected record or Run clears local diagnostic preview")

            # Separate local finding is not a Run or synthetic timeline event.
            standalone = {
                "owner": "local-demo",
                "outcome": "UNRESOLVED",
                "firstFailureStage": "RAN Adoption",
                "firstFailureNode": "await-result",
                "predicate": "observation.received",
                "ownerResult": {
                    "reason": "WAIT_BUDGET_EXHAUSTED",
                    "observationsUsed": 3,
                },
                "networkEffect": "NONE: network accepted; no mutation replayed",
                "fix": {
                    "waitScope": "Require exact attempt selector",
                    "procedureBindings": "Bind an explicit attempt context",
                },
                "bindingsSupplied": {"purpose": "local", "operationContextRef": "fake-private"},
                "rootCause": "Sensitive source note imsi-synthetic-secret",
            }
            before_runs = page.locator(".run-list .run-option").count()
            page.locator("#review-finding-json").set_input_files({
                "name": "synthetic-finding.json",
                "mimeType": "application/json",
                "buffer": json.dumps(standalone).encode("utf-8"),
            })
            report = page.get_by_role("region", name="Standalone diagnosis report")
            report.wait_for(timeout=10000)
            assert "WAIT_BUDGET_EXHAUSTED" in report.inner_text()
            assert "RAN Adoption" in report.inner_text()
            assert "NOT linked to the selected Run" in report.inner_text()
            assert "imsi-synthetic-secret" not in page.locator(".app-shell").inner_text()
            assert page.locator(".run-list .run-option").count() == before_runs
            checks.append("Independent local finding is readable without fabricating owner events or Run linkage")

            page.get_by_role("combobox", name="Choose demo example").select_option(label="Delivery failure · Host RESULT_UNKNOWN")
            assert report.count() == 0
            page.get_by_role("button", name="View standalone finding").click()
            report.wait_for(timeout=10000)
            assert "NOT linked to the selected Run" in report.inner_text()
            checks.append("Switching Run hides unrelated report; explicit re-open keeps source warning")

            page.set_viewport_size({"width": 680, "height": 860})
            assert picker.is_visible()
            assert page.locator(".sidebar-bottom").is_visible()
            assert picker.locator("option").count() == 5
            page.set_viewport_size({"width": 1600, "height": 1000})
            checks.append("Built-in example picker remains accessible on narrow screens")

            page.screenshot(path=str(OUT / "trace-viewer-console-parity.png"), full_page=True)
            assert not errors, f"Browser JavaScript errors: {errors}"
            checks.append("No browser JavaScript exceptions")
        finally:
            proof = {"classification":"SYNTHETIC_ONLY", "checks":checks,
                     "pageErrors":errors, "lastUrl":page.url,
                     "chromeScreenshot":"trace-viewer-console-parity.png",
                     "notTested":["real owner-native imports","full DSH Console UI parity",
                                  "Evidence material integrity","Phoenix embed integration",
                                  "GitHub Pages deployment"]}
            (OUT / "viewer-ui.json").write_text(json.dumps(proof, indent=2)+"\n")
            print("VIEWER_UI_PROOF "+json.dumps(proof))
            if not (OUT / "trace-viewer-console-parity.png").exists():
                page.screenshot(path=str(OUT / "trace-viewer-console-parity.png"), full_page=True)
            browser.close()


if __name__ == "__main__":
    main()
