#!/usr/bin/env python3
"""Synthetic, read-only OTLP -> local Phoenix end-to-end smoke test.

No network calls to a model, tool provider, CA services or real 5GC.
No real user prompts, tokens, credentials or production trace materials.
This script depends on separately installed Phoenix + OTel Python packages.
"""
from __future__ import annotations

import json
import os
import time
from collections import Counter
from pathlib import Path

from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from phoenix.client import Client

PROJECT = "trace-viewer-synthetic-poc"
ENDPOINT = os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://127.0.0.1:6006")


def put(span, **attributes):
    for key, value in attributes.items():
        span.set_attribute(key.replace("__", "."), value)


def run_synthetic_traces(tracer):
    # Path A: synthetic DSH-style Agent -> Model -> Tool -> Harness -> next Model.
    with tracer.start_as_current_span("invoke_agent synthetic-agent") as agent:
        put(agent, gen_ai__operation__name="invoke_agent", gen_ai__agent__name="synthetic-agent",
            openinference__span__kind="AGENT", ca__source__owner="synthetic-agent-host",
            ca__task__ref="synthetic-task-1", ca__capture__classification="SYNTHETIC")
        with tracer.start_as_current_span("chat synthetic-model") as model:
            put(model, gen_ai__operation__name="chat", gen_ai__request__model="synthetic-model",
                openinference__span__kind="LLM", ca__model__request__ref="synthetic-request-1",
                ca__model__response__ref="synthetic-response-1",
                ca__tool__selected_request_ref="synthetic-tool-request-1")
            # Explicitly synthetic snapshots. Real model content is NOT collected.
            model.set_attribute("input.value", '{"synthetic":true,"message":"check synthetic state"}')
            model.set_attribute("output.value", '{"synthetic":true,"tool":"query-synthetic-state"}')
        with tracer.start_as_current_span("execute_tool query-synthetic-state") as tool:
            put(tool, gen_ai__operation__name="execute_tool", gen_ai__tool__name="query-synthetic-state",
                openinference__span__kind="TOOL", ca__tool__request__ref="synthetic-tool-request-1",
                ca__tool__result__ref="synthetic-tool-result-1", ca__runtime__run_id="synthetic-run-1")
            with tracer.start_as_current_span("Harness admission") as gate:
                put(gate, ca__stage="ADMISSION", ca__decision="ALLOW",
                    ca__tool__request__ref="synthetic-tool-request-1",
                    ca__evidence__ref="synthetic-admission-evidence")
            tool.set_attribute("output.value", '{"synthetic":true,"state":"OBSERVED"}')
            tool.add_event("ca.tool.result.delivered",
                           {"ca.tool.result.ref": "synthetic-tool-result-1"})
        with tracer.start_as_current_span("chat synthetic-model followup") as next_model:
            put(next_model, gen_ai__operation__name="chat", gen_ai__request__model="synthetic-model",
                openinference__span__kind="LLM",
                ca__model__request__ref="synthetic-request-2",
                ca__tool__result__source_ref="synthetic-tool-result-1")

    # Path B: deterministic Procedure + mutation uncertainty + reconcile.
    # Do NOT tag this as gen_ai.invoke_agent: no model/agent call occurred.
    with tracer.start_as_current_span("Procedure synthetic-root") as procedure:
        put(procedure, ca__execution__kind="DETERMINISTIC", ca__source__owner="synthetic-runtime",
            ca__runtime__run_id="synthetic-run-2",
            ca__procedure__invocation_id="synthetic-invocation-root",
            ca__runtime__control_state="SUCCEEDED",
            ca__external__disposition="UNAVAILABLE",
            ca__capture__classification="SYNTHETIC")
        with tracer.start_as_current_span("Predicate observation") as observation:
            put(observation, ca__stage="OBSERVATION", ca__predicate__name="synthetic.predicate",
                ca__predicate__status="OBSERVED",
                ca__evidence__ref="synthetic-evidence-1")
            observation.add_event("ca.evidence.observed",
                                  {"ca.evidence.ref": "synthetic-evidence-1",
                                   "ca.source.owner": "synthetic-runtime"})
        with tracer.start_as_current_span("Operation uncertain") as action:
            put(action, ca__stage="EXECUTION", ca__operation__ref="synthetic-operation-1",
                ca__operation__outcome="OUTCOME_UNKNOWN",
                ca__procedure__invocation_id="synthetic-invocation-root")
        with tracer.start_as_current_span("Reconcile result") as reconciled:
            put(reconciled, ca__stage="RECONCILIATION", ca__operation__ref="synthetic-operation-1",
                ca__reconcile__resolution="COMMITTED",
                ca__evidence__ref="synthetic-evidence-2")
            reconciled.add_event("ca.reconcile.completed",
                                 {"ca.evidence.ref": "synthetic-evidence-2",
                                  "ca.reconcile.resolution": "COMMITTED"})


def check_local_spans(spans):
    assert len(spans) == 9, f"expected 9 spans, found {len(spans)}"
    by_name = {span.name: span for span in spans}
    assert len(by_name) == len(spans), "duplicate span names"
    a = by_name["invoke_agent synthetic-agent"]
    b = by_name["Procedure synthetic-root"]
    assert a.context.trace_id != b.context.trace_id, "different executions must not be implicitly linked"
    assert a.parent is None and b.parent is None, "expected two roots"
    assert by_name["Harness admission"].parent.span_id == by_name["execute_tool query-synthetic-state"].context.span_id
    assert by_name["Reconcile result"].parent.span_id == b.context.span_id
    assert by_name["Operation uncertain"].attributes["ca.operation.outcome"] == "OUTCOME_UNKNOWN"
    assert by_name["Reconcile result"].attributes["ca.reconcile.resolution"] == "COMMITTED"
    assert by_name["Procedure synthetic-root"].attributes["ca.external.disposition"] == "UNAVAILABLE"
    assert by_name["chat synthetic-model followup"].attributes["ca.tool.result.source_ref"] == "synthetic-tool-result-1"
    assert by_name["chat synthetic-model"].attributes["ca.tool.selected_request_ref"] == "synthetic-tool-request-1"
    assert by_name["Predicate observation"].events[0].attributes["ca.evidence.ref"] == "synthetic-evidence-1"
    return by_name


def check_phoenix_query():
    client = Client(base_url=ENDPOINT)
    last_error = None
    for attempt in range(15):
        try:
            frame = client.spans.get_spans_dataframe(project_identifier=PROJECT, limit=100)
            if len(frame) >= 9:
                names = set(frame["name"].tolist())
                assert "invoke_agent synthetic-agent" in names
                assert "Procedure synthetic-root" in names
                assert "Reconcile result" in names
                return {"spanCount": len(frame), "rootCountExpected": 2,
                        "matched": ["invoke_agent synthetic-agent", "Procedure synthetic-root",
                                    "Reconcile result"]}
            last_error = f"queried {len(frame)} spans; expected >=9"
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        time.sleep(2)
    raise RuntimeError("Phoenix span query failed: " + str(last_error))


def main():
    # Local-server export only; no external backend, telemetry, LLM or provider.
    os.environ["PHOENIX_DISCOVER_CONFIG"] = "false"
    provider = TracerProvider(resource=Resource.create({
        "service.name": PROJECT,
        "openinference.project.name": PROJECT,
    }))
    # Two independent processors: OTLP delivery AND local structure evidence.
    provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(
        endpoint=ENDPOINT.rstrip("/") + "/v1/traces", timeout=10,
    )))
    memory = InMemorySpanExporter()
    provider.add_span_processor(SimpleSpanProcessor(memory))
    run_synthetic_traces(provider.get_tracer("trace-viewer-poc"))
    assert provider.force_flush(timeout_millis=15000), "OTLP export timed out"
    spans = memory.get_finished_spans()
    check_local_spans(spans)
    remote = check_phoenix_query()
    proof = {
        "classification": "SYNTHETIC_ONLY",
        "backend": "Arize Phoenix / OTLP HTTP",
        "project": PROJECT,
        "localSpanCount": len(spans),
        "distinctTraceCount": len({s.context.trace_id for s in spans}),
        "spanKinds": dict(Counter(s.attributes.get("openinference.span.kind", "CA") for s in spans)),
        "phoenixQuery": remote,
        "checks": ["Agent/Model/Tool tree", "Harness admission child",
                   "Tool result consumed by next Model via exact ref",
                   "deterministic Procedure/Evidence", "OUTCOME_UNKNOWN -> Reconcile COMMITTED",
                   "separate external disposition UNAVAILABLE", "two separate trace IDs"],
        "notTested": ["real model/tool call", "CA owner-native importer",
                      "evidence integrity/digest", "UI visual inspection",
                      "Span events/attributes fully visible in Phoenix UI",
                      "SDK sampling/export failure/crash recovery"],
    }
    text = json.dumps(proof, ensure_ascii=False, indent=2)
    print("POC_PASS\n" + text)
    target = os.getenv("POC_PROOF_FILE")
    if target:
        Path(target).write_text(text + "\n", encoding="utf-8")
    provider.shutdown()


if __name__ == "__main__":
    main()
