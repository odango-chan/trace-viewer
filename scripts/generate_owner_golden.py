#!/usr/bin/env python3
"""Generate exclusively synthetic TraceStore/v2 fixtures with the real upstream Writer.

Must be executed with PYTHONPATH=<pinned-ca-agent-demo-repo>/src.
No production files, model calls, network services or credential dependencies.
The matching native TraceStore.load_run() reopens every generated fixture.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from ca_agent_demo.demo.trace.events import TraceRecorder, TraceStage
from ca_agent_demo.demo.trace.store import TraceStore


def deterministic(store: TraceStore) -> dict:
    run_id = "synthetic-owner-det-v2"
    recorder = TraceRecorder(run_id)
    lineage = {
        "attempt": 1,
        "procedure_invocation_id": "synthetic-root-1",
        "owner_kind": "ROOT",
        "skill": "synthetic-skill",
        "procedure": "synthetic-procedure",
    }
    recorder.emit(TraceStage.HOST, "DEMO_MODE", "Synthetic deterministic route",
                  data={"mode": "mechanism", "sourceName": "synthetic"})
    with recorder.span("Synthetic deterministic root", TraceStage.RUNTIME,
                       attributes={"mode": "mechanism", "synthetic": True}):
        recorder.emit(TraceStage.RUNTIME, "PROCEDURE_ENTER", "Synthetic root entered", data=lineage)
        recorder.emit(TraceStage.RUNTIME, "PROCEDURE_NODE_ENTER", "Synthetic step entered",
                      data={**lineage, "node": "synthetic-node-a"})
        recorder.emit(TraceStage.RUNTIME, "FACT", "Synthetic observation", data={"synthetic": True},
                      material={"synthetic": True, "unicode": "合成证据", "facts": ["only-test"]})
        recorder.emit(TraceStage.RUNTIME, "PROCEDURE_TERMINAL", "Synthetic root completed",
                      data={**lineage, "outcome": "SATISFIED"})
    recorder.emit(TraceStage.HOST, "RUN_SUCCEEDED", "Synthetic run completed")
    store.persist(recorder.finish())
    reopened = store.load_run(run_id)
    assert len(reopened.events) == 6
    assert reopened.metadata["totalLlmCalls"] == 0
    assert len(reopened.metadata["spans"]) == 1
    return {"runId": run_id, "events": len(reopened.events), "spans": len(reopened.metadata["spans"]),
            "nativeLoadRun": "PASS", "syntheticOnly": True}


def model(store: TraceStore) -> dict:
    run_id = "synthetic-owner-model-v2"
    recorder = TraceRecorder(run_id, intent_calls=1)
    call = {"call_index": 1, "model_call_id": "intent:1", "model_stage": "intent"}
    recorder.emit(TraceStage.HOST, "DEMO_MODE", "Synthetic model route",
                  data={"mode": "synthetic", "sourceName": "synthetic"})
    recorder.emit(TraceStage.INTENT, "INTENT_MODEL_REQUEST", "Synthetic model request",
                  data=call, material={"synthetic": True, "payload": "synthetic model-visible input"})
    with recorder.span("LLM remote call · intent", TraceStage.INTENT,
                       attributes={"model_stage": "intent", "call_index": 1, "attempt": 1}):
        # No real model is invoked. Output material is authored synthetic.
        recorder.emit(TraceStage.INTENT, "INTENT_MODEL_RESPONSE", "Synthetic model response",
                      data=call, material={"synthetic": True, "response": "synthetic output"})
    recorder.emit(TraceStage.INTENT, "INTENT_MODEL_VALIDATION", "Synthetic response accepted",
                  data={**call, "result": "ACCEPTED"}, material={"synthetic": True, "validation": "ACCEPTED"})
    recorder.emit(TraceStage.HOST, "GOAL_PRODUCED", "Synthetic goal",
                  material={"synthetic": True, "goal": "demo"})
    recorder.emit(TraceStage.HOST, "RUN_SUCCEEDED", "Synthetic run completed")
    store.persist(recorder.finish())
    reopened = store.load_run(run_id)
    assert len(reopened.events) == 6
    assert reopened.metadata["intentInterpretationLlmCalls"] == 1
    assert reopened.metadata["totalLlmCalls"] == 1
    assert len(reopened.metadata["spans"]) == 1
    return {"runId": run_id, "events": len(reopened.events), "spans": len(reopened.metadata["spans"]),
            "nativeLoadRun": "PASS", "syntheticOnly": True}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    store = TraceStore(args.output)
    proof = {
        "classification": "SYNTHETIC_ONLY",
        "owner": "ca-agent-demo",
        "format": "TraceStore/v2",
        "generationMethod": "TraceRecorder -> TraceStore.persist -> TraceStore.load_run",
        "runs": [deterministic(store), model(store)],
    }
    path = args.output / "native-writer-proof.json"
    path.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("OWNER_GOLDEN_PASS " + json.dumps(proof, ensure_ascii=False))


if __name__ == "__main__":
    main()
