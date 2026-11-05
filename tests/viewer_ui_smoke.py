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
            page.locator(".turn-card .turn-header").first.click()
            assert page.locator(".trace-event .event-meta").filter(has_text="Model Interaction").count() >= 1
            checks.append("Readable view folds explicit Model Request/Response")
            page.get_by_role("button", name="All owners", exact=True).click()
            assert page.locator(".owner-lane").count() >= 4
            checks.append("All owners uses separate Agent/Runtime/Fabric/World lanes")
            page.get_by_role("button", name="Raw records", exact=True).click()
            assert "synthetic:model-req-1" in page.locator(".timeline").inner_text()
            page.locator(".turn-card .trace-event").first.click()
            page.get_by_role("button", name="Source", exact=True).click()
            assert '"sourceKind": "SYNTHETIC"' in page.locator(".source-preview").inner_text()
            checks.append("Raw records and Inspector source refs preserve original identity")

            page.get_by_role("button", name="Delivery failure · Host RESULT_UNKNOWN").click()
            page.get_by_role("button", name="Focus unknown").click()
            assert page.locator(".inspector-title").inner_text() == "Host delivery interrupted"
            assert "RESULT_UNKNOWN" in page.locator(".inspector").inner_text()
            page.get_by_role("button", name="All", exact=True).click()
            assert "Runtime SUCCEEDED" in page.locator(".timeline").inner_text()
            checks.append("Host RESULT_UNKNOWN distinct from Runtime SUCCEEDED")

            page.get_by_role("button", name="Parallel reads · out-of-order ToolResults").click()
            page.locator(".turn-card .turn-header").first.click()
            assert page.locator(".trace-event .event-meta").filter(has_text="Tool Interaction").count() == 2
            page.get_by_text("query_session (A)", exact=True).click()
            assert page.locator(".paired-sources button").count() == 2
            page.locator(".paired-sources button").nth(1).click()
            assert "synthetic:parallel-result-a" in page.locator(".source-preview").inner_text()
            checks.append("Two out-of-order ToolResults pair by exact call ref")

            page.get_by_role("button", name="Frozen Procedure · without a model call").click()
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

            page.get_by_role("button", name="All", exact=True).click()
            page.locator(".timeline .trace-event").filter(has_text="CALL_RESULT").first.click()
            assert page.locator(".local-detail-fields").count() == 0
            page.get_by_role("button", name="Show allowed local fields").click()
            page.get_by_text("smf.create_context", exact=True).wait_for(timeout=10000)
            assert "smf.create_context" in page.locator(".local-detail").inner_text()
            assert "synthetic-hidden-binding" not in page.locator(".app-shell").inner_text()
            page.get_by_role("button", name="Frozen Procedure · without a model call").click()
            assert page.locator(".local-detail").count() == 0
            checks.append("Changing selected record or Run clears local diagnostic preview")

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
