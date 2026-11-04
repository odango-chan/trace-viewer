/**
 * Educational, non-authoritative synthetic traces.
 * NO user identifiers, real runtime events, credentials or model prompts.
 */
export const samples = Object.freeze([
  {
    id: 'synthetic-agent-recovery',
    sourceKind: 'SYNTHETIC',
    mode: 'AGENT / MODEL',
    title: 'Agent Turn · Release, uncertainty & reconcile',
    subtitle: 'DSH-inspired Model → Tool → Harness → Runtime → Delivery',
    note: 'Demonstration only. The records below were authored for this UI, not captured from DeepSeek or a real owner.',
    sections: [
      {
        id: 'turn-1', title: 'TURN 01 · Model chooses a tool', subtitle: 'Request / Response folding · one explicit Tool Call', kind: 'turn',
        records: [
          {ref:'synthetic:model-req-1',sourceAuthority:'synthetic:agent',ownerSequence:1,kind:'MODEL_REQUEST',title:'Model Input Snapshot',summary:'EXECUTION · A goal-scoped toolset is visible to the model',status:'OBSERVED',causalRefs:[]},
          {ref:'synthetic:model-resp-1',sourceAuthority:'synthetic:agent',ownerSequence:2,kind:'MODEL_RESPONSE',title:'Model Output · request release',summary:'The model selects a release tool. Selection is not an executed mutation.',status:'OBSERVED',causalRefs:['synthetic:model-req-1']},
          {ref:'synthetic:toolcall-1',sourceAuthority:'synthetic:agent',ownerSequence:3,kind:'TOOL_CALL',title:'Tool Call · release_pdu_session',summary:'callId = synthetic:call-release-1',status:'REQUESTED',causalRefs:['synthetic:model-resp-1']},
        ],
      },
      {
        id: 'step-1', title: 'STEP 01 · Tool interaction', subtitle: 'Harness gates, outcome uncertainty, reconcile and delivery', kind: 'tool',
        records: [
          {ref:'synthetic:gate-1',sourceAuthority:'synthetic:runtime',ownerSequence:1,kind:'HARNESS_ADMISSION',title:'Harness · Admission',summary:'Mutation request admitted for this synthetic example',status:'PASS',causalRefs:['synthetic:toolcall-1']},
          {ref:'synthetic:dispatch-1',sourceAuthority:'synthetic:runtime',ownerSequence:2,kind:'DISPATCH',title:'Runtime · Dispatch',summary:'The external mutation may have crossed the effect boundary',status:'ATTEMPTED',causalRefs:['synthetic:gate-1']},
          {ref:'synthetic:unknown-1',sourceAuthority:'synthetic:runtime',ownerSequence:3,kind:'OUTCOME',title:'OUTCOME_UNKNOWN',summary:'A missing response is not proof of NOT_COMMITTED or FAILED',status:'OUTCOME_UNKNOWN',causalRefs:['synthetic:dispatch-1']},
          {ref:'synthetic:reconcile-1',sourceAuthority:'synthetic:runtime',ownerSequence:4,kind:'RECONCILE',title:'Reconcile exact original',summary:'Owner evidence resolves the same invocation without replaying the mutation',status:'COMMITTED',causalRefs:['synthetic:unknown-1']},
          {ref:'synthetic:toolresult-1',sourceAuthority:'synthetic:agent',ownerSequence:4,kind:'TOOL_RESULT',title:'ToolResult delivered',summary:'Result belongs to the matching synthetic callId, not a neighboring Tool Call',status:'DELIVERED',causalRefs:['synthetic:toolcall-1','synthetic:reconcile-1']},
        ],
      },
      {
        id: 'turn-2', title: 'TURN 02 · Model observes result', subtitle: 'Next effective model input sees the delivered ToolResult', kind: 'turn',
        records: [
          {ref:'synthetic:model-req-2',sourceAuthority:'synthetic:agent',ownerSequence:5,kind:'MODEL_REQUEST',title:'Model Input · continuation',summary:'Includes delivered tool result reference; no hidden thought content',status:'OBSERVED',causalRefs:['synthetic:toolresult-1']},
          {ref:'synthetic:model-resp-2',sourceAuthority:'synthetic:agent',ownerSequence:6,kind:'MODEL_RESPONSE',title:'Final response',summary:'Observable response only; not a substitute for external business truth',status:'COMPLETED',causalRefs:['synthetic:model-req-2']},
        ],
      },
    ],
  },
  {
    id: 'synthetic-deterministic',
    sourceKind: 'SYNTHETIC',
    mode: 'DETERMINISTIC',
    title: 'Frozen Procedure · without a model call',
    subtitle: 'Admission → Procedure → Evidence → Terminal · no LLM inferred',
    note: 'Generic fabricated execution skeleton. It does not represent a real CreatedSession pass or a Fabric disposition.',
    sections: [
      {
        id:'det-ingress',title:'ENTRY · Source & Admission',subtitle:'Exact provenance is required before execution',kind:'entry',
        records:[
          {ref:'synthetic:entry-1',sourceAuthority:'synthetic:host',ownerSequence:1,kind:'INGRESS',title:'Source event accepted',summary:'A declared run identity is bound to the input',status:'OBSERVED',causalRefs:[]},
          {ref:'synthetic:admit-1',sourceAuthority:'synthetic:host',ownerSequence:2,kind:'ADMISSION',title:'Frozen Skill admitted',summary:'Artifact identity must bind the executable content',status:'PASS',causalRefs:['synthetic:entry-1']},
        ],
      },
      {
        id:'det-proc',title:'EXECUTION · Procedure and evidence',subtitle:'Node outcomes, predicates, and exact evidence refs',kind:'procedure',
        records:[
          {ref:'synthetic:node-1',sourceAuthority:'synthetic:runtime',ownerSequence:1,kind:'PROCEDURE_NODE_ENTER',title:'Procedure step',summary:'Frozen node / invocation / occurrence identify this specific visit',status:'RUNNING',causalRefs:['synthetic:admit-1']},
          {ref:'synthetic:observe-1',sourceAuthority:'synthetic:runtime',ownerSequence:2,kind:'OBSERVATION_ACQUIRED',title:'Observation',summary:'Evidence provenance and freshness belong to the owner, not the graph',status:'AVAILABLE',causalRefs:['synthetic:node-1']},
          {ref:'synthetic:verify-1',sourceAuthority:'synthetic:runtime',ownerSequence:3,kind:'VERIFY_RESULT',title:'Predicate verified',summary:'One exact invocation/attempt receives PASS',status:'PASS',causalRefs:['synthetic:observe-1']},
          {ref:'synthetic:terminal-1',sourceAuthority:'synthetic:runtime',ownerSequence:4,kind:'RUNTIME_TERMINAL',title:'Runtime terminal',summary:'SUCCEEDED describes the frozen execution only',status:'SUCCEEDED',causalRefs:['synthetic:verify-1']},
        ],
      },
      {
        id:'det-external',title:'EXTERNAL · Separate responsibility',subtitle:'The external owner can have a distinct disposition',kind:'external',
        records:[
          {ref:'synthetic:disposition-1',sourceAuthority:'synthetic:fabric',ownerSequence:1,kind:'DISPOSITION',title:'External action disposition',summary:'UNRESOLVED does not erase the Runtime terminal; no second status is inferred',status:'UNRESOLVED',causalRefs:['synthetic:terminal-1']},
        ],
      },
    ],
  },
])
