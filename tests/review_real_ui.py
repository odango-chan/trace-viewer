"""Smoke real archived diagnostic JSONL in the Viewer, inside PRIVATE owner CI.

The UI may display source-local names, but this test emits only aggregate outcomes,
never screenshots, DOM snapshots, file contents, or trace values.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.getenv("VIEWER_URL","http://127.0.0.1:8123")
FILE=Path(os.environ["REAL_DIAGNOSTIC_PATH"])


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1450,"height":920})
        errors=[]
        urls=[]
        page.on("pageerror",lambda e: errors.append(type(e).__name__))
        page.on("request",lambda r: urls.append(r.url))
        page.goto(URL,wait_until="domcontentloaded",timeout=30000)
        page.locator("#review-jsonl").set_input_files(str(FILE))
        page.get_by_role("heading",name="Archived diagnostic · "+FILE.name,exact=True).wait_for(timeout=20000)
        assert "ARCHIVED DIAGNOSTIC" in page.locator(".synthetic-badge").inner_text()
        assert page.locator(".metric").filter(has_text="Visible records").locator("strong").inner_text()=="106"
        assert page.locator(".timeline .trace-event").count()==106
        assert "not an owner-native TraceStore" in page.locator(".info-note").inner_text()
        page.locator(".timeline .trace-event").first.click()
        page.get_by_role("button",name="Source",exact=True).click()
        source=page.locator(".source-preview").inner_text()
        assert '"sourceKind": "REVIEW_DIAGNOSTIC"' in source
        assert '"ownerSequence": null' in source
        assert '"sourceLine": 1' in source
        assert not errors, "JavaScript errors during private import"
        assert all(x.startswith(URL+"/") for x in urls), "External network request during local diagnostic import"
        print("PRIVATE_DIAGNOSTIC_CHROMIUM_PASS: 106 redacted lines, no fabricated sequence, no external requests")
        browser.close()


if __name__=="__main__":
    main()
