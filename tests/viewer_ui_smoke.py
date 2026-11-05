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
