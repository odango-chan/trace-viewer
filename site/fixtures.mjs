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
  },,
  {
    id: 'synthetic-host-delivery-gap', sourceKind: 'SYNTHETIC', mode: 'AGENT / MODEL',
    title: 'Delivery failure · Host RESULT_UNKNOWN',
    subtitle: 'Console anomaly reference: Runtime SUCCEEDED is not Host knowledge',
    note: 'Synthetic scenario adapted from ca-console trajectory-anomaly-prototype.html. Runtime knows the operation succeeded; the Host did not receive its ToolResult until recovery.',
    sections: [
      { id: 'host-turn', title: 'TURN 01 · Model initiates tool', subtitle: 'Model selection is not the effect', kind: 'turn', records: [
        {ref:'synthetic:host-model-req',sourceAuthority:'synthetic:agent',ownerSequence:1,kind:'MODEL_REQUEST',title:'Model input',summary:'A synthetic tool catalog is visible',status:'OBSERVED',causalRefs:[]},
        {ref:'synthetic:host-model-resp',sourceAuthority:'synthetic:agent',ownerSequence:2,kind:'MODEL_RESPONSE',title:'Model selects release',summary:'Tool invocation selected; not yet executed',status:'OBSERVED',causalRefs:['synthetic:host-model-req']},
        {ref:'synthetic:host-call',sourceAuthority:'synthetic:agent',ownerSequence:3,kind:'TOOL_CALL',title:'release_pdu_session',summary:'Original request identity synthetic:request-301',status:'REQUESTED',causalRefs:['synthetic:host-model-resp']},
      ]},
      { id: 'host-runtime', title: 'STEP 01 · Runtime completes', subtitle: 'One authoritative Runtime outcome', kind: 'tool', records: [
        {ref:'synthetic:host-admission',sourceAuthority:'synthetic:runtime',ownerSequence:1,kind:'HARNESS_ADMISSION',title:'Authorization & assurance',summary:'The synthetic operation is admitted',status:'PASS',causalRefs:['synthetic:host-call']},
        {ref:'synthetic:host-runtime-terminal',sourceAuthority:'synthetic:runtime',ownerSequence:2,kind:'RUNTIME_TERMINAL',title:'Runtime SUCCEEDED',summary:'Effect was committed; this fact does not change if ToolResult delivery fails',status:'SUCCEEDED',causalRefs:['synthetic:host-admission']},
        {ref:'synthetic:host-delivery-lost',sourceAuthority:'synthetic:agent',ownerSequence:4,kind:'HOST_DELIVERY',title:'Host delivery interrupted',summary:'Host RESULT_UNKNOWN; Runtime result remains authoritative',status:'RESULT_UNKNOWN',causalRefs:['synthetic:host-call','synthetic:host-runtime-terminal']},
      ]},
      { id: 'host-recover', title: 'STEP 02 · Resolve original request', subtitle: 'No duplicate mutation', kind: 'tool', records: [
        {ref:'synthetic:host-resolve',sourceAuthority:'synthetic:agent',ownerSequence:5,kind:'RESOLVE_REQUEST',title:'Resolve existing request/run',summary:'No second release dispatch; reuse original identity',status:'COMMITTED',causalRefs:['synthetic:host-delivery-lost','synthetic:host-runtime-terminal']},
        {ref:'synthetic:host-result',sourceAuthority:'synthetic:agent',ownerSequence:6,kind:'TOOL_RESULT',title:'Recovered ToolResult delivered',summary:'Explicitly paired to original synthetic:host-call',status:'DELIVERED',causalRefs:['synthetic:host-call','synthetic:host-resolve']},
      ]},
    ],
  },
  {
    id: 'synthetic-parallel-tool-results', sourceKind: 'SYNTHETIC', mode: 'AGENT / MODEL',
    title: 'Parallel reads · out-of-order ToolResults',
    subtitle: 'Console anomaly reference: match by callId, not arrival order',
    note: 'Both results are synthetic. Result B arrives before result A; exact causal refs are required for correct folding.',
    sections: [
      { id:'parallel-turn', title:'TURN 01 · Two concurrent read calls', subtitle:'Results arrive in opposite order', kind:'turn', records:[
        {ref:'synthetic:parallel-model-req',sourceAuthority:'synthetic:agent',ownerSequence:1,kind:'MODEL_REQUEST',title:'Model input · two read tools',summary:'Visible tool definitions are synthetic',status:'OBSERVED',causalRefs:[]},
        {ref:'synthetic:parallel-model-resp',sourceAuthority:'synthetic:agent',ownerSequence:2,kind:'MODEL_RESPONSE',title:'Model selects two read tools',summary:'Read-only requests A and B',status:'OBSERVED',causalRefs:['synthetic:parallel-model-req']},
        {ref:'synthetic:parallel-call-a',sourceAuthority:'synthetic:agent',ownerSequence:3,kind:'TOOL_CALL',title:'query_session (A)',summary:'Call A requested first',status:'REQUESTED',causalRefs:['synthetic:parallel-model-resp']},
        {ref:'synthetic:parallel-call-b',sourceAuthority:'synthetic:agent',ownerSequence:4,kind:'TOOL_CALL',title:'query_path (B)',summary:'Call B requested second',status:'REQUESTED',causalRefs:['synthetic:parallel-model-resp']},
        {ref:'synthetic:parallel-result-b',sourceAuthority:'synthetic:agent',ownerSequence:5,kind:'TOOL_RESULT',title:'Result B first',summary:'Explicit causal edge to call B',status:'DELIVERED',causalRefs:['synthetic:parallel-call-b']},
        {ref:'synthetic:parallel-result-a',sourceAuthority:'synthetic:agent',ownerSequence:6,kind:'TOOL_RESULT',title:'Result A second',summary:'Explicit causal edge to call A',status:'DELIVERED',causalRefs:['synthetic:parallel-call-a']},
      ]},
      { id:'parallel-next', title:'TURN 02 · Model consumes both results', subtitle:'One input, two exact source refs',kind:'turn',records:[
        {ref:'synthetic:parallel-next-input',sourceAuthority:'synthetic:agent',ownerSequence:7,kind:'MODEL_REQUEST',title:'Next Model Input',summary:'Consumes both A and B by their exact result refs',status:'OBSERVED',causalRefs:['synthetic:parallel-result-a','synthetic:parallel-result-b']},
      ]},
    ],
  },
])
