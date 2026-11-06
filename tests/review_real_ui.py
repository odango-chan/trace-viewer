"""Private-only Chromium readback of real P8-D4 review material.

Run only in the authorized ca-agent-demo workspace. Never emit raw source data,
DOM snapshots, screenshots, IDs, URL queries or private artifacts. The separate
attempt-1 diagnosis is NOT joined to the attempt-2 diagnostic event stream.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.getenv("VIEWER_URL", "http://127.0.0.1:8123")
TRACE = Path(os.environ["REAL_DIAGNOSTIC_PATH"])
FINDING = Path(os.getenv("REAL_DIAGNOSIS_PATH", str(TRACE.with_name("attempt1-diagnosis.json"))))
KINDS = (
    "PREDICATE_EVALUATED", "VERIFY_RESULT", "CALL_RESULT",
    "GRAPH_TRANSITION", "PROCEDURE_TERMINAL", "SKILL_RESULT",
)

def loaded_line(file, kind, predicate=None):
    """Select an exact physical source line; never log its private contents."""
    with file.open("r", encoding="utf-8") as stream:
        for number, raw in enumerate(stream, 1):
            item = json.loads(raw)
            if item.get("kind") != kind:
                continue
            if predicate is not None and not predicate(item):
                continue
            return number
    raise AssertionError("Required diagnostic kind/condition unavailable")

def select_line(page, file, number):
    # Explicit review line locator, not an Owner event sequence.
    page.get_by_role("button", name="Raw records", exact=True).click()
    target = page.locator(".timeline .trace-event").filter(
        has_text="review:" + file.name + ":line=" + str(number)
    )
    target.first.click()

def main():
    assert TRACE.is_file() and FINDING.is_file(), "Private source not mounted"
    assert TRACE.parent == FINDING.parent, "Private files must share an authorized archive"
    checks = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1450, "height": 920})
        browser_errors = []
        requests = []
        page.on("pageerror", lambda e: browser_errors.append(type(e).__name__))
        page.on("request", lambda r: requests.append(r.url))
        try:
            page.goto(URL, wait_until="domcontentloaded", timeout=30000)
            page.locator("#review-jsonl").set_input_files(str(TRACE))
            page.get_by_role(
                "heading", name="Archived diagnostic · " + TRACE.name, exact=True
            ).wait_for(timeout=20000)
            assert "ARCHIVED DIAGNOSTIC" in page.locator(".synthetic-badge").inner_text()
            assert page.locator(".metric").filter(
                has_text="Visible records"
            ).locator("strong").inner_text() == "106"
            assert page.locator(".timeline .trace-event").count() == 106
            assert "not an owner-native TraceStore" in page.locator(".info-note").inner_text()
            checks.append("Private attempt-2 review imported as 106 source lines, not Owner-native")

            for kind in KINDS:
                line = loaded_line(TRACE, kind)
                select_line(page, TRACE, line)
                assert page.locator(".inspector .inspector-title").inner_text() == kind
                page.get_by_role(
                    "button", name="Show allowed local fields", exact=True
                ).click()
                page.get_by_role(
                    "button", name="Hide local details", exact=True
                ).wait_for(timeout=10000)
                assert page.locator(".local-detail-fields").count() == 1
                assert "Owner Loader" not in page.locator(".local-detail-fields").inner_text()
                page.get_by_role("button", name="Hide local details").click()
            checks.append("Six real event kinds show bounded local detail only on explicit click")

            # If report's Predicate reason is absent, say NOT PROVIDED, not WITHHELD.
            no_reason = loaded_line(TRACE, "PREDICATE_EVALUATED", 
                                    lambda x: x.get("data", {}).get("reason") is None)
            select_line(page, TRACE, no_reason)
            page.get_by_role("button", name="Show allowed local fields").click()
            page.get_by_text("[NOT PROVIDED IN SOURCE]", exact=True).wait_for(timeout=10000)
            checks.append("Real null Predicate reason is labeled absent, not redacted")

            # Source-only locality is not cross-Owner causality or an event sequence.
            page.get_by_role("button", name="Source", exact=True).click()
            assert '"sourceLine": ' + str(no_reason) in page.locator(".source-preview").inner_text()
            page.get_by_role("button", name="Next line · " + str(no_reason+1), exact=True).click()
            assert '"sourceLine": ' + str(no_reason+1) in page.locator(".source-preview").inner_text()
            assert "does not establish causality" in page.locator(".review-line-context").inner_text()
            checks.append("Real source adjacent line navigation preserves file-only provenance")

            # Review import groups physical lines into 25-line presentation sections.
            # Section navigation never crosses that group boundary implicitly.
            select_line(page, TRACE, 26)
            page.get_by_role("button", name="Summary", exact=True).click()
            context = page.get_by_role("region", name="Reading context")
            assert "1 / 25 in section" in context.inner_text()
            assert page.get_by_role("button", name="Previous record", exact=True).is_disabled()
            page.get_by_role("button", name="Next record", exact=True).click()
            page.get_by_role("button", name="Source", exact=True).click()
            assert '"sourceLine": 27' in page.locator(".source-preview").inner_text()
            page.get_by_role("button", name="Back to prior source", exact=True).click()
            # Back restores the original inspector tab (Summary), not Source.
            assert page.get_by_role("button", name="Summary", exact=True).get_attribute("aria-pressed") == "true"
            assert "1 / 25 in section" in context.inner_text()
            page.get_by_role("button", name="Source", exact=True).click()
            assert '"sourceLine": 26' in page.locator(".source-preview").inner_text()
            page.get_by_role("button", name="Locate selected", exact=True).click()
            assert page.locator(".timeline .trace-event.selected").count() == 1
            checks.append("Real section-scoped context navigates and returns without joining event streams")

            # The separate, real attempt-1 diagnosis must not become an event or join.
            baseline = page.locator(".run-list .run-option").count()
            page.locator("#review-finding-json").set_input_files(str(FINDING))
            panel = page.get_by_role("region", name="Standalone diagnosis report")
            panel.wait_for(timeout=10000)
            assert "NOT linked to the selected Run" in panel.inner_text()
            assert "WAIT_BUDGET_EXHAUSTED" in panel.inner_text()
            assert "RAN Adoption" in panel.inner_text()
            assert "NOT_VERIFIED" in panel.inner_text()
            assert page.locator(".run-list .run-option").count() == baseline
            assert page.locator(".timeline .trace-event").count() == 106
            checks.append("Real attempt-1 finding remains independent of attempt-2 Run")

            page.get_by_role("combobox", name="Choose demo example").select_option(label="Frozen Procedure · without a model call")
            assert panel.count() == 0
            page.get_by_role("button", name="View standalone finding").click()
            panel.wait_for(timeout=10000)
            assert "NOT linked to the selected Run" in panel.inner_text()
            checks.append("Report hides on Run change and reopens without fabricated association")

            page.get_by_role("button", name="Source", exact=True).click()
            assert not browser_errors, "Private Viewer raised browser JavaScript errors"
            assert all(url.startswith(URL + "/") for url in requests), (
                "Viewer emitted an external request during private local-only import"
            )
            checks.append("Private local-only Viewer emitted no external requests or JS errors")
            # Never print private record text, source locations or identifiers.
            print("PRIVATE_VIEWER_V1_CHROMIUM_PASS: " + str(len(checks)) + 
                  " checks; source values withheld; no screenshots or DOM exported")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
