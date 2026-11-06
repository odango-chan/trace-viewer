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
            assert page.get_by_role("navigation", name="Application menus").is_visible()
            assert page.get_by_role("contentinfo", name="Workbench status").is_visible()
            assert "SYNTHETIC EXAMPLE" in page.locator(".app-statusbar").inner_text()
            assert page.locator(".import-block").count() == 0
            file_button = page.get_by_role("button", name="File", exact=True)
            file_button.click()
            file_menu = page.get_by_role("menu", name="File menu")
            assert file_menu.get_by_role("menuitem").count() == 3
            with page.expect_file_chooser(timeout=10000) as chooser:
                file_menu.get_by_role("menuitem", name="Open TraceStore v2 folder").click()
            assert chooser.value.element.get_attribute("id") == "native-directory"
            assert not file_menu.is_visible()
            checks.append("File menu opens browser-local folder picker without sidebar import form")

            page.get_by_role("button", name="View", exact=True).click()
            view_menu = page.get_by_role("menu", name="View menu")
            assert view_menu.get_by_role("menuitemradio", name="Readable ledger").get_attribute("aria-checked") == "true"
            view_menu.get_by_role("menuitemcheckbox", name="Show Inspector").click()
            assert not page.locator(".inspector").is_visible()
            assert page.locator(".workbench.inspector-hidden").count() == 1
            page.get_by_role("button", name="View", exact=True).click()
            page.get_by_role("menuitemcheckbox", name="Show Inspector").click()
            assert page.locator(".inspector").is_visible()
            checks.append("View menu toggles Inspector without losing selected source")

            page.get_by_role("button", name="Navigate", exact=True).click()
            nav_menu = page.get_by_role("menu", name="Navigate menu")
            nav_menu.get_by_role("menuitem", name="Expand all").click()
            assert page.locator(".timeline .trace-event").count() >= 2
            page.set_viewport_size({"width": 1600, "height": 580})
            layout = page.evaluate("""() => ({
                pageScroll: window.scrollY,
                bodyOverflow: getComputedStyle(document.body).overflow,
                mainScrollable: document.querySelector('.canvas').scrollHeight > document.querySelector('.canvas').clientHeight,
                sidebarScrollable: getComputedStyle(document.querySelector('.section-index')).overflowY,
                headerTop: document.querySelector('.topbar').getBoundingClientRect().top,
                footerBottom: document.querySelector('.app-statusbar').getBoundingClientRect().bottom,
                viewportHeight: innerHeight
            })""")
            assert layout["bodyOverflow"] == "hidden"
            assert layout["mainScrollable"]
            assert layout["sidebarScrollable"] == "auto"
            assert layout["headerTop"] == 0
            assert abs(layout["footerBottom"] - layout["viewportHeight"]) <= 2
            canvas_box = page.locator(".canvas").bounding_box()
            page.mouse.move(canvas_box["x"] + canvas_box["width"] * .5,
                            canvas_box["y"] + canvas_box["height"] * .5)
            page.mouse.wheel(0, 780)
            page.wait_for_function("document.querySelector('.canvas').scrollTop > 0")
            assert page.evaluate("window.scrollY") == 0
            assert page.locator(".topbar").bounding_box()["y"] == 0
            assert abs(page.locator(".app-statusbar").bounding_box()["y"] +
                       page.locator(".app-statusbar").bounding_box()["height"] - 580) <= 2
            checks.append("Desktop wheel scrolls trace pane, not topbar or statusbar")

            inspector = page.locator(".inspector")
            assert inspector.evaluate("(el) => el.scrollHeight > el.clientHeight")
            inspector_box = inspector.bounding_box()
            page.mouse.move(inspector_box["x"] + inspector_box["width"] / 2,
                            inspector_box["y"] + inspector_box["height"] / 2)
            canvas_scroll = page.locator(".canvas").evaluate("(el) => el.scrollTop")
            page.mouse.wheel(0, 540)
            page.wait_for_function("document.querySelector('.inspector').scrollTop > 0")
            assert page.locator(".canvas").evaluate("(el) => el.scrollTop") == canvas_scroll
            assert page.evaluate("window.scrollY") == 0
            checks.append("Inspector wheel scrolls separately from source ledger")

            page.set_viewport_size({"width": 1024, "height": 580})
            assert page.locator(".inspector").is_visible()
            assert page.locator(".topbar").bounding_box()["y"] == 0
            assert abs(page.locator(".app-statusbar").bounding_box()["y"] +
                       page.locator(".app-statusbar").bounding_box()["height"] - 580) <= 2
            assert page.locator(".canvas").evaluate("(el) => getComputedStyle(el).overflowY") == "auto"
            assert page.evaluate("window.scrollY") == 0
            checks.append("Narrow desktop keeps two independent panes inside viewport")
            page.set_viewport_size({"width": 1600, "height": 1000})
            page.get_by_role("button", name="Navigate", exact=True).click()
            page.get_by_role("menuitem", name="Collapse all sections").click()
            assert page.locator(".timeline .trace-event").count() == 0
            checks.append("Navigate menu expands and collapses all sections")

            page.get_by_role("button", name="Help", exact=True).click()
            page.get_by_role("menuitem", name="Trace semantics").click()
            assert page.get_by_role("dialog", name="Trace semantics").is_visible()
            assert "not inferred causality" in page.get_by_role("dialog").inner_text().lower()
            page.keyboard.press("Escape")
            assert page.get_by_role("dialog").count() == 0
            checks.append("Help explains source semantics and closes with Escape")
            page.reload(wait_until="domcontentloaded")
            page.get_by_text("SYNTHETIC DATA", exact=True).wait_for(timeout=15000)
            explorer = page.get_by_role("navigation", name="Current run records")
            assert explorer.is_visible()
            assert page.locator(".sidebar-run-summary").is_visible()
            assert "source records" in page.locator(".sidebar-run-summary").inner_text()
            assert explorer.locator(".sidebar-section").count() >= 2
            assert explorer.locator(".sidebar-section-active .sidebar-record.active").count() == 1
            assert explorer.locator(".sidebar-record").count() >= 1
            current_section = explorer.locator(".sidebar-section-active")
            section_toggle = current_section.locator(".sidebar-section-toggle")
            assert section_toggle.get_attribute("aria-expanded") == "true"
            section_toggle.click()
            assert section_toggle.get_attribute("aria-expanded") == "false"
            assert current_section.locator(".sidebar-record").count() == 0
            section_toggle.click()
            assert section_toggle.get_attribute("aria-expanded") == "true"
            assert current_section.locator(".sidebar-record").count() >= 1
            first_record = current_section.locator(".sidebar-record").first
            record_title = first_record.get_attribute("title")
            first_record.click()
            assert page.get_by_role("button", name="Raw records", exact=True).get_attribute("aria-pressed") == "true"
            assert page.locator(".timeline .trace-event.selected").count() == 1
            assert explorer.locator(".sidebar-record.active").count() == 1
            assert page.locator(".inspector-title").is_visible()
            checks.append("Explorer expands real chapter records and navigates exact sources")
            page.reload(wait_until="domcontentloaded")
            page.get_by_text("SYNTHETIC DATA", exact=True).wait_for(timeout=15000)
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
                "(node) => getComputedStyle(node).color") == "rgb(82, 106, 125)"
            assert surfaces[".turn-body"] == surfaces[".turn-card"]
            checks.append("Skill Studio light palette restored without breaking dense trace rows")
            overview = page.locator(".page-heading")
            assert page.locator(".breadcrumb").count() == 0
            assert overview.locator(".eyebrow").inner_text() == "RUN OVERVIEW"
            assert overview.locator("h1").get_attribute("title") == overview.locator("h1").inner_text()
            assert overview.locator("p").get_attribute("title") == overview.locator("p").inner_text()
            assert "DSH-inspired" in overview.locator("p").inner_text()
            for width in (1600, 1180):
                page.set_viewport_size({"width": width, "height": 1000})
                title_box = overview.locator("h1").bounding_box()
                subtitle_box = overview.locator("p").bounding_box()
                assert overview.bounding_box()["height"] <= 38
                assert abs((title_box["y"] + title_box["height"] / 2) -
                           (subtitle_box["y"] + subtitle_box["height"] / 2)) <= 5
            page.set_viewport_size({"width": 1600, "height": 1000})
            checks.append("Run Overview label, title and subtitle use one compact row at desktop widths")
            assert page.get_by_text("Source records", exact=True).is_visible()
            assert page.get_by_text("Source authorities", exact=True).is_visible()
            assert page.locator(".metric").first.bounding_box()["height"] <= 58
            assert page.locator(".timeline").bounding_box()["y"] < 450
            page.locator(".turn-card .turn-header").first.click()
            assert page.locator(".timeline .ledger-kind").first.is_visible()
            assert "MODEL_" in page.locator(".timeline .ledger-kind").first.inner_text()
            checks.append("Compact above-fold trajectory retains explicit source kinds and accurate totals")
            assert page.locator(".ledger-view").count() >= 1
            assert page.locator(".owner-lane").count() == 0
            assert page.locator(".ledger-head").first.is_visible()
            assert page.locator(".ledger-event .ledger-kind").filter(has_text="Model Interaction").count() >= 1
            assert "synthetic:agent" in page.locator(".ledger-event .ledger-authority").first.inner_text()
            assert "synthetic:model-req-1" in page.locator(".ledger-event .ledger-ref").first.inner_text()
            assert page.locator(".ledger-event .event-side").first.is_visible()
            checks.append("Readable source ledger shows folded interaction, authority, exact ref, status and position")
            type_proof = page.evaluate("""() => {
                const selectors = [
                    '.ledger-event-main strong', '.ledger-event-main small',
                    '.ledger-event .ledger-kind', '.ledger-event .ledger-authority',
                    '.ledger-event .ledger-ref', '.ledger-event .event-side small',
                    '.sidebar-section-title', '.section-index .sidebar-record',
                    '.inspector-title', '.inspector-description',
                    '.inspector-label', '.properties dt', '.properties dd',
                ]
                const samples = Object.fromEntries(selectors.map(selector => {
                    const node = document.querySelector(selector)
                    const style = getComputedStyle(node)
                    return [selector, {color: style.color, fontSize: parseFloat(style.fontSize)}]
                }))
                const root = getComputedStyle(document.documentElement)
                return {samples, palette: [
                    root.getPropertyValue('--bg').trim(),
                    root.getPropertyValue('--accent').trim(),
                    root.getPropertyValue('--type-strong').trim(),
                    root.getPropertyValue('--type-body').trim(),
                    root.getPropertyValue('--type-meta').trim(),
                ]}
            }""")
            assert type_proof["palette"] == ["#f5f7fb", "#0c8e7b",
                "#20314a", "#41586d", "#526a7d"]
            for selector, minimum in {
                ".ledger-event-main strong": 12,
                ".ledger-event-main small": 11,
                ".ledger-event .ledger-kind": 10,
                ".ledger-event .ledger-authority": 10,
                ".ledger-event .ledger-ref": 10,
                ".ledger-event .event-side small": 10,
                ".sidebar-section-title": 11,
                ".section-index .sidebar-record": 11,
                ".inspector-title": 15,
                ".inspector-description": 12,
                ".inspector-label": 10,
                ".properties dt": 11,
                ".properties dd": 12,
            }.items():
                assert type_proof["samples"][selector]["fontSize"] >= minimum, (selector, type_proof["samples"][selector])
            assert type_proof["samples"][".ledger-event-main strong"]["color"] == "rgb(32, 49, 74)"
            assert type_proof["samples"][".ledger-event-main small"]["color"] == "rgb(65, 88, 109)"
            assert type_proof["samples"][".properties dd"]["color"] == "rgb(32, 49, 74)"
            assert type_proof["samples"][".ledger-event .ledger-kind"]["color"] == "rgb(12, 118, 104)"
            checks.append("Source ledger, Explorer and Inspector use readable primary / body / metadata typography")
            row = page.locator(".ledger-event").first
            assert row.locator(".ledger-event-main strong").is_visible()
            assert row.locator(".ledger-event-main small").is_visible()
            assert row.bounding_box()["height"] <= 44
            assert row.locator(".ledger-event-main").evaluate("(el) => getComputedStyle(el).whiteSpace") == "nowrap"
            assert row.locator(".event-side").evaluate("(el) => getComputedStyle(el).flexDirection") == "row"
            assert "synthetic:model-req-1" in row.locator(".ledger-source").get_attribute("title")
            assert "snapshot" in row.locator(".ledger-event-main").get_attribute("title").lower()
            page.set_viewport_size({"width": 1180, "height": 900})
            assert row.bounding_box()["height"] <= 44
            page.set_viewport_size({"width": 1600, "height": 1000})
            checks.append("Readable records use one physical line at desktop and laptop widths")
            harness = page.locator(".ledger-event").filter(has_text="Harness · Admission").first
            assert harness.is_visible()
            assert harness.bounding_box()["height"] <= 44
            assert "HARNESS_ADMISSION" in harness.locator(".ledger-kind").inner_text()
            assert "synthetic:runtime" in harness.locator(".ledger-authority").inner_text()
            assert harness.locator(".ledger-ref-count").inner_text() == "↳1"
            checks.append("Harness Admission remains one line with explicit source and causal-ref count")
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
            page.get_by_role("button", name="Navigate", exact=True).click()
            page.get_by_role("menuitem", name="Collapse all sections").click()
            page.get_by_role("button", name="Locate selected").click()
            assert page.get_by_role("button", name="Raw records", exact=True).get_attribute("aria-pressed") == "true"
            assert page.locator(".timeline .trace-event.selected").count() == 1
            checks.append("Locate selected reveals collapsed source and selects its exact raw row")

            page.get_by_role("combobox", name="Choose demo example").select_option(label="Parallel reads · out-of-order ToolResults")
            page.locator(".turn-card .turn-header").first.click()
            assert page.locator(".ledger-event .ledger-kind").filter(has_text="Tool Interaction").count() == 2
            page.locator(".timeline").get_by_text("query_session (A)", exact=True).click()
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
            assert page.evaluate("getComputedStyle(document.body).overflow") == "visible"
            assert page.locator(".canvas").evaluate("(el) => getComputedStyle(el).overflowY") == "visible"
            assert page.locator(".page-heading").bounding_box()["height"] <= 38
            assert page.locator(".page-heading h1").is_visible()
            assert page.locator(".page-heading p").is_visible()
            assert page.get_by_role("button", name="File", exact=True).is_visible()
            assert page.get_by_role("contentinfo", name="Workbench status").is_visible()
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
