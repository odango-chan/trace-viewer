#!/usr/bin/env python3
"""Browser-only Phoenix UI smoke over SYNTHETIC traces. No production sources.

This probes what the app actually renders; does not assume any Phoenix project URL.
Captures screenshot + scoped DOM summary for investigation.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

SERVER = os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://127.0.0.1:6006")
PROJECT = "trace-viewer-synthetic-poc"
OUT = Path(os.getenv("PHOENIX_UI_PROOF_DIR", "/tmp/phoenix-ui-proof"))
OUT.mkdir(parents=True, exist_ok=True)


def summary(page, note):
    body = page.locator("body").inner_text(timeout=10000)
    return {
        "checkpoint": note,
        "url": page.url,
        "title": page.title(),
        "projectVisible": PROJECT in body,
        "agentTraceVisible": "invoke_agent synthetic-agent" in body,
        "procedureTraceVisible": "Procedure synthetic-root" in body,
        "bodyPreview": body[:1400],
    }


def main():
    proof = {"classification": "SYNTHETIC_ONLY", "smoke": [], "checks": [],
             "uiParity": "NOT_ESTABLISHED", "diagnostics": []}
    success = False
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 950}, device_scale_factor=1)
        page.on("pageerror", lambda exc: proof["diagnostics"].append(str(exc)[:200]))
        try:
            page.goto(SERVER, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(1500)
            proof["smoke"].append(summary(page, "landing"))
            project = page.get_by_text(PROJECT, exact=False)
            if project.count() > 0:
                project.first.click(timeout=8000)
                page.wait_for_timeout(1700)
                proof["checks"].append("clicked project by rendered text")
            proof["smoke"].append(summary(page, "project-view"))
            # A project page may render the Trace list asynchronously and behind a tab.
            if not ("invoke_agent synthetic-agent" in page.locator("body").inner_text()
                    and "Procedure synthetic-root" in page.locator("body").inner_text()):
                traces = page.get_by_role("tab", name="Traces")
                if traces.count():
                    traces.first.click(timeout=7000)
                    page.wait_for_timeout(1500)
                    proof["checks"].append("clicked Traces tab")
            proof["smoke"].append(summary(page, "traces-view"))
            visible_text = page.locator("body").inner_text()
            success = ("invoke_agent synthetic-agent" in visible_text
                       and "Procedure synthetic-root" in visible_text)
            if success:
                proof["checks"].append("Both synthetic trace root labels rendered in browser")
                # Click the Agent trace and check that the browser renders at least
                # one descendant; click failures are separate from list rendering.
                try:
                    page.get_by_text("invoke_agent synthetic-agent", exact=False).first.click(timeout=6000)
                    page.wait_for_timeout(1200)
                    detail = page.locator("body").inner_text()
                    proof["detailShowsModelOrTool"] = (
                        "chat synthetic-model" in detail or "query-synthetic-state" in detail
                    )
                except Exception as exc:
                    proof["diagnostics"].append("Trace detail interaction unavailable: " + str(exc)[:180])
            proof["uiParity"] = ("TRACE_LIST_VISIBLE" if success else "TRACE_LIST_NOT_VERIFIED")
        except Exception as exc:
            proof["diagnostics"].append("browser failure: " + repr(exc)[:500])
        finally:
            page.screenshot(path=str(OUT / "phoenix-synthetic.png"), full_page=True)
            (OUT / "phoenix-synthetic-ui.json").write_text(
                json.dumps(proof, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            browser.close()
    print("PHOENIX_UI_PROOF " + json.dumps(proof, ensure_ascii=False))
    if not success:
        raise AssertionError("Phoenix UI did not render both synthetic trace roots; check UI proof artifact")


if __name__ == "__main__":
    main()
