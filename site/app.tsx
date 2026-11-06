import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { samples } from './fixtures.mjs'
import { allRecords, defaultOpenSections, getSourceLinks, inspectorEvidenceStatus, isException, recordReadingContext, reviewFileNeighbors, runSummary, sourceOverviewLabel } from './projection.mjs'
import { findPrimaryUnknown, projectLanes, projectSectionRows } from './console-parity.mjs'
import { importTraceStoreFiles } from './native-import.mjs'
import { importReviewDiagnosticFile } from './review-diagnostic.mjs'
import { readLocalReviewDetail, reviewDetailAvailable } from './review-detail.mjs'
import { importReviewFindingFile } from './review-finding.mjs'

type TraceRecord = {
  ref: string
  sourceAuthority: string
  ownerSequence: number | null
  sourceLine?: number
  kind: string
  title: string
  summary: string
  status: string
  causalRefs: string[]
  materialRef?: string | null
  sourceLocator?: string
  stage?: string
}
type Section = {
  id: string
  title: string
  subtitle: string
  kind: string
  records: TraceRecord[]
}
type PresentationRow = {
  key: string
  source: TraceRecord
  members: TraceRecord[]
  label: string
  lane: string
  isFolded: boolean
}
type LocalReviewDetail = {
  runId: string
  recordRef: string
  fields: {label: string; value: string}[]
  materialReported: boolean
  evidenceRefCount: number | null
  sourceLine: number
  kind: string
}
type ReviewFinding = {
  sourceKind: 'REVIEW_FINDING'
  title: string
  sourceLocator: string
  sourceAuthority: string
  fields: {label: string; value: string}[]
  bindingNames: string[]
  suppressedOriginalText: boolean
  ownerSequence: null
  runAssociation: 'NOT_ESTABLISHED'
  evidenceIntegrity: 'NOT_VERIFIED'
}
type ReturnSelection = {ref: string; tab: InspectorTab}
type ViewMode = 'readable' | 'model' | 'owners' | 'raw'
type InspectorTab = 'summary' | 'source' | 'links'
type ExampleRun = {
  id: string
  sourceKind: 'SYNTHETIC' | 'NATIVE_LOCAL' | 'REVIEW_DIAGNOSTIC'
  mode: string
  title: string
  subtitle: string
  note: string
  sections: Section[]
}
const syntheticRuns = samples as unknown as ExampleRun[]

function statusClass(status: string): string {
  if (['UNKNOWN', 'OUTCOME_UNKNOWN', 'RESULT_UNKNOWN', 'UNRESOLVED'].includes(status)) return 'status uncertain'
  if (['FAIL', 'FAILED', 'BLOCKED', 'DENIED', 'SAFE_STOPPED'].includes(status)) return 'status danger'
  if (['PASS', 'SUCCEEDED', 'COMMITTED', 'COMPLETED', 'DELIVERED'].includes(status)) return 'status good'
  if (['ATTEMPTED', 'RUNNING', 'REQUESTED'].includes(status)) return 'status pending'
  return 'status neutral'
}

function kindSymbol(kind: string): string {
  if (kind.includes('MODEL')) return '◆'
  if (kind.includes('TOOL')) return '↗'
  if (kind.includes('RECONCILE')) return '↻'
  if (kind.includes('OBSERVATION') || kind.includes('VERIFY')) return '◇'
  if (kind.includes('OUTCOME') || kind.includes('DISPOSITION')) return '!'
  return '○'
}

function App() {
  const [nativeRun, setNativeRun] = useState<ExampleRun | null>(null)
  const [reviewRun, setReviewRun] = useState<ExampleRun | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [finding, setFinding] = useState<ReviewFinding | null>(null)
  const [findingVisible, setFindingVisible] = useState(false)
  const [findingError, setFindingError] = useState<string | null>(null)
  const directoryRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLElement | null>(null)
  const locateCounter = useRef(0)
  const [locateRequest, setLocateRequest] = useState<{ref:string; request:number} | null>(null)
  const [returnSelection, setReturnSelection] = useState<ReturnSelection | null>(null)
  const reviewFileRef = useRef<{file: File; runId: string} | null>(null)
  const detailRequest = useRef(0)
  const [localDetail, setLocalDetail] = useState<LocalReviewDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  function hideLocalDetail() {
    detailRequest.current += 1
    setLocalDetail(null)
    setDetailBusy(false)
    setDetailError(null)
  }
  const importedRuns = [reviewRun, nativeRun].filter(Boolean) as ExampleRun[]
  const runs = [...importedRuns, ...syntheticRuns]
  async function importReview(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    hideLocalDetail()
    setReturnSelection(null)
    setLocateRequest(null)
    setFindingVisible(false)
    setImporting(true)
    setImportError(null)
    try {
      const imported = await importReviewDiagnosticFile(file) as ExampleRun
      reviewFileRef.current = {file, runId: imported.id}
      setReviewRun(imported)
      setRunId(imported.id)
      setExpanded(new Set(imported.sections.map(s => s.id)))
      const reviewRecords = imported.sections.flatMap(section => section.records)
      setSelectedRef((reviewRecords.find(record => isException(record) && reviewDetailAvailable(record.kind))
        ?? reviewRecords.find(record => reviewDetailAvailable(record.kind))
        ?? reviewRecords[0])?.ref ?? '')
      setFilter('all')
      setViewMode('raw')
      setInspectorTab('summary')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Diagnostic import failed')
    } finally {
      setImporting(false)
      input.value = ''
    }
  }
  async function importFinding(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setFindingError(null)
    setFindingVisible(false)
    setFinding(null)
    try {
      const parsed = await importReviewFindingFile(file) as ReviewFinding
      setFinding(parsed)
      setFindingVisible(true)
    } catch {
      setFindingError('This standalone diagnosis JSON is unsupported or unsafe.')
    } finally {
      input.value = ''
    }
  }

  const [runId, setRunId] = useState(syntheticRuns[0].id)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultOpenSections(syntheticRuns[0])))
  const [selectedRef, setSelectedRef] = useState<string>(syntheticRuns[0].sections[1].records[2].ref)
  useEffect(() => {
    if (directoryRef.current) directoryRef.current.webkitdirectory = true
  }, [])

  async function importDirectory(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const selectedFiles = input.files
    if (!selectedFiles?.length) return
    hideLocalDetail()
    setReturnSelection(null)
    setLocateRequest(null)
    setFindingVisible(false)
    setImporting(true)
    setImportError(null)
    try {
      const imported = await importTraceStoreFiles(selectedFiles) as ExampleRun
      setNativeRun(imported)
      setRunId(imported.id)
      setExpanded(new Set(imported.sections.map(section => section.id)))
      setSelectedRef(imported.sections.flatMap(section => section.records)[0]?.ref ?? '')
      setFilter('all')
      setViewMode('readable')
      setInspectorTab('summary')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Native import failed')
    } finally {
      setImporting(false)
      input.value = ''
    }
  }
  const [filter, setFilter] = useState<'all' | 'exceptions'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('readable')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('summary')
  const run = runs.find(item => item.id === runId) ?? runs[0]
  const records = allRecords(run) as TraceRecord[]
  const activeRecord = records.find(record => record.ref === selectedRef) ?? null
  const evidenceStatus = inspectorEvidenceStatus(run, activeRecord)
  const neighbors = reviewFileNeighbors(run, activeRecord)
  const readingContext = recordReadingContext(run, activeRecord)
  const canReturn = !!returnSelection && records.some(record => record.ref === returnSelection.ref)
  useEffect(() => {
    if (!locateRequest) return
    const visibleRows = canvasRef.current?.querySelectorAll<HTMLButtonElement>('.trace-event')
    const target = Array.from(visibleRows ?? []).find(row=>row.dataset.sourceRef === locateRequest.ref)
    target?.scrollIntoView({block:'center',behavior:'auto'})
  }, [locateRequest, expanded, viewMode, filter, runId])
  const shownDetail = localDetail?.runId === run.id && localDetail?.recordRef === activeRecord?.ref ? localDetail : null
  const canRevealLocalDetail = run.sourceKind === 'REVIEW_DIAGNOSTIC' &&
    !!activeRecord && Number.isSafeInteger(activeRecord.sourceLine) &&
    reviewDetailAvailable(activeRecord.kind) && reviewFileRef.current?.runId === run.id
  async function revealLocalDetail() {
    if (!canRevealLocalDetail || !activeRecord || !activeRecord.sourceLine) return
    const held = reviewFileRef.current
    if (!held || held.runId !== run.id) return
    hideLocalDetail()
    const request = detailRequest.current
    setDetailBusy(true)
    try {
      const safe = await readLocalReviewDetail(held.file, activeRecord.sourceLine, activeRecord.kind)
      if (request !== detailRequest.current) return
      setLocalDetail({...safe, runId: run.id, recordRef: activeRecord.ref})
    } catch {
      if (request !== detailRequest.current) return
      setDetailError('This local source line could not be inspected safely.')
    } finally {
      if (request === detailRequest.current) setDetailBusy(false)
    }
  }
  const summary = runSummary(run)
  const causalLinks = activeRecord ? getSourceLinks(run, activeRecord) : []
  const activePresentationRow = run.sections.flatMap(section =>
    projectSectionRows(run, section, viewMode) as PresentationRow[]
  ).find(row => row.members.some(member => member.ref === selectedRef)) ?? null

  function requestLocate(ref: string) {
    locateCounter.current += 1
    setLocateRequest({ref, request: locateCounter.current})
  }

  function locateSelected() {
    if (!activeRecord) return
    setFilter('all')
    setViewMode('raw')
    const section = run.sections.find(part=>part.records.some(record=>record.ref===activeRecord.ref))
    if (section) setExpanded(previous=>new Set(previous).add(section.id))
    requestLocate(activeRecord.ref)
  }

  function navigateToRecord(target: TraceRecord | null, tab: InspectorTab = 'summary') {
    if (!target || target.ref === selectedRef) {
      if (target && tab !== inspectorTab) setInspectorTab(tab)
      return
    }
    if (activeRecord) setReturnSelection({ref: activeRecord.ref, tab: inspectorTab})
    hideLocalDetail()
    setFilter('all')
    setViewMode('raw')
    const section = run.sections.find(part=>part.records.some(record=>record.ref===target.ref))
    if (section) setExpanded(previous=>new Set(previous).add(section.id))
    setSelectedRef(target.ref)
    setInspectorTab(tab)
    requestLocate(target.ref)
  }

  function returnToSource() {
    if (!returnSelection) return
    const target = records.find(record=>record.ref===returnSelection.ref)
    const tab = returnSelection.tab
    setReturnSelection(null)
    if (!target) return
    hideLocalDetail()
    setFilter('all')
    setViewMode('raw')
    const section = run.sections.find(part=>part.records.some(record=>record.ref===target.ref))
    if (section) setExpanded(previous=>new Set(previous).add(section.id))
    setSelectedRef(target.ref)
    setInspectorTab(tab)
    requestLocate(target.ref)
  }

  function focusUnknown() {
    const record = findPrimaryUnknown(run) as TraceRecord | null
    if (!record) return
    if (record.ref === selectedRef) {
      hideLocalDetail()
      setViewMode('raw')
      const section = run.sections.find(part=>part.records.some(item=>item.ref===record.ref))
      if (section) setExpanded(previous=>new Set(previous).add(section.id))
      setInspectorTab('summary')
      requestLocate(record.ref)
    } else navigateToRecord(record)
    setFilter('exceptions')
  }

  function selectRecord(ref: string) {
    setLocateRequest(null)
    if (ref === selectedRef) {
      setInspectorTab('summary')
      return
    }
    if (activeRecord) setReturnSelection({ref: activeRecord.ref, tab: inspectorTab})
    hideLocalDetail()
    setSelectedRef(ref)
    setInspectorTab('summary')
  }

  function goToReviewLine(target: TraceRecord | null) {
    navigateToRecord(target, 'source')
  }

  function recordPosition(record: TraceRecord) {
    return record.ownerSequence === null ? 'file line ' + (record.sourceLine ?? '?') : 'seq ' + record.ownerSequence
  }
  function renderRecordRow(row: PresentationRow) {
    const active = row.members.some(member => member.ref === selectedRef)
    const isLedger = viewMode === 'readable'
    const source = row.source
    const terminal = row.members[row.members.length - 1]
    const warning = row.members.some(isException)
    return (
      <button key={row.key} type="button"
        className={'trace-event ' + (active ? 'selected' : '') + (isLedger ? ' ledger-event' : '')}
        data-source-ref={source.ref}
        onClick={() => selectRecord(source.ref)} aria-pressed={active}>
        <span className={'event-glyph ' + (warning ? 'glyph-warning' : '')}>{kindSymbol(source.kind)}</span>
        <span className="event-detail">
          {!isLedger && <span className="event-meta">{viewMode === 'raw' ? 'SOURCE RECORD' : row.label} <span>·</span> {source.sourceAuthority}{viewMode !== 'raw' && <span className="event-kind"> · {source.kind}</span>}</span>}
          <strong>{viewMode === 'raw' ? source.kind : source.title}</strong>
          <small>{viewMode === 'raw' ? source.ref : source.summary}</small>
          {row.isFolded && !isLedger && <span className="fold-source-refs">{row.members.map(member => member.kind + ' · ' + recordPosition(member)).join('  →  ')}</span>}
        </span>
        {isLedger && (
          <span className="ledger-source">
            <span className="ledger-kind">{row.isFolded ? row.label + ' · ' + source.kind : source.kind}</span>
            <span className="ledger-authority">{source.sourceAuthority}{source.stage ? ' · ' + source.stage : ''}</span>
            <span className="ledger-ref" title={source.ref}>{source.ref}</span>
            {source.causalRefs.length > 0 && <span className="ledger-ref-count">{source.causalRefs.length} declared causal ref{source.causalRefs.length === 1 ? '' : 's'}</span>}
          </span>
        )}
        <span className="event-side">
          <span className={statusClass(terminal.status)}>{terminal.status}</span>
          <small>{row.isFolded ? row.members.length + ' exact sources' : recordPosition(source)}</small>
        </span>
      </button>
    )
  }

  function selectRun(next: ExampleRun) {
    hideLocalDetail()
    setReturnSelection(null)
    setLocateRequest(null)
    setFindingVisible(false)
    setRunId(next.id)
    setExpanded(new Set(defaultOpenSections(next)))
    setFilter('all')
    setViewMode('readable')
    setInspectorTab('summary')
    const recordsForRun = allRecords(next) as TraceRecord[]
    setSelectedRef((recordsForRun.find(isException) ?? recordsForRun[0])?.ref ?? '')
  }

  function toggleSection(id: string) {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">↳</div>
        <div className="brand-copy">
          <strong>Trace Viewer</strong>
          <small>ConnectionAgent / Developer Tools</small>
        </div>
        <span className="header-divider" />
        <span className="header-context">Execution observability</span>
        <div className="topbar-spacer" />
        <span className="build-badge">D1 · LOCAL PREVIEW</span>
        <span className="synthetic-badge">{run.sourceKind === 'SYNTHETIC' ? 'SYNTHETIC DATA'
          : run.sourceKind === 'NATIVE_LOCAL' ? 'LOCAL NATIVE · NOT OWNER VERIFIED'
          : 'ARCHIVED DIAGNOSTIC · NOT OWNER NATIVE'}</span>
      </header>

      <div className="workbench">
        <aside className="sidebar" aria-label="Run explorer">
          <div className="sidebar-heading">EXPLORER</div>
          <div className="sidebar-caption">LOCAL RUNS <span>{importedRuns.length}</span></div>
          <div className="import-block">
            <label htmlFor="native-directory">Import TraceStore v2 folder</label>
            <input ref={directoryRef} id="native-directory" type="file" multiple
              aria-label="Import TraceStore v2 directory" onChange={importDirectory} />
            <small>{importing ? 'Checking local files…' : 'Browser-only · no upload · run.json + trace.jsonl + materials'}</small>
            <label htmlFor="review-jsonl">Import archived diagnostic JSONL</label>
            <input id="review-jsonl" type="file" accept=".jsonl" aria-label="Import archived diagnostic JSONL"
              onChange={importReview} />
            <small>Separate unversioned review export; NOT TraceStore v2.</small>
            <label htmlFor="review-finding-json">Import standalone diagnosis JSON</label>
            <input id="review-finding-json" type="file" accept=".json"
              aria-label="Import standalone diagnosis JSON" onChange={importFinding} />
            <small>Independent review note · never attached to the selected Run or timeline.</small>
            {finding && <button type="button" className="finding-open-control"
              onClick={() => setFindingVisible(value => !value)}>
              {findingVisible ? 'Hide standalone finding' : 'View standalone finding'}
            </button>}
            {findingError && <p role="alert" className="import-error">{findingError}</p>}
            {importError && <p className="import-error" role="alert">{importError}</p>}
          </div>
          <div className="run-list">
            {importedRuns.length === 0 && (
              <p className="run-empty">No local trace loaded. Import a file above, or choose a built-in example below.</p>
            )}
            {importedRuns.map(item => (
              <button key={item.id} type="button" className={'run-option ' + (item.id === run.id ? 'active' : '')} onClick={() => selectRun(item)} aria-pressed={item.id === run.id}>
                <span className="run-option-icon">◇</span>
                <span className="run-option-copy">
                  <strong>{item.title}</strong>
                  <small>{sourceOverviewLabel(item)} · Local only</small>
                </span>
              </button>
            ))}
          </div>
          <div className="sidebar-divider" />
          <div className="sidebar-caption">THIS RUN</div>
          <div className="section-index">
            {run.sections.map((section, i) => (
              <button key={section.id} type="button" onClick={() => navigateToRecord(section.records[0] ?? null)}>
                <span className="section-index-num">{String(i + 1).padStart(2, '0')}</span>
                <span>{section.title.replace(/^TURN \d+ · |^STEP \d+ · |^ENTRY · |^EXECUTION · |^EXTERNAL · /, '')}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="example-picker">
              <label htmlFor="demo-example">BUILT-IN EXAMPLES <span>{syntheticRuns.length}</span></label>
              <select id="demo-example" aria-label="Choose demo example"
                value={run.sourceKind === 'SYNTHETIC' ? run.id : ''}
                onChange={event => {
                  const example = syntheticRuns.find(item => item.id === event.currentTarget.value)
                  if (example) selectRun(example)
                }}>
                <option value="" disabled>Choose a sample…</option>
                {syntheticRuns.map(item => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
              <small>Illustrative data only · not a real execution</small>
            </div>
            <div className="sidebar-privacy"><span className="indicator" /> Read-only · browser-local imports</div>
          </div>
        </aside>

        <main ref={canvasRef} className="canvas">
          <div className="breadcrumb">WORKSPACE <span>/</span> TRACE <span>/</span> {run.mode}</div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">RUN OVERVIEW</div>
              <h1>{run.title}</h1>
              <p>{run.subtitle}</p>
            </div>
          </div>

          <div className="metric-row">
            <div className="metric"><span>{run.sourceKind === 'SYNTHETIC' ? 'Execution mode' : 'Imported source'}</span><strong>{sourceOverviewLabel(run)}</strong></div>
            <div className="metric"><span>Source records</span><strong>{summary.events}</strong></div>
            <div className="metric"><span>Source authorities</span><strong>{summary.ownerStreams}</strong></div>
            <div className="metric"><span>Exception flags</span><strong className="warning-text">{summary.exceptions}</strong></div>
          </div>

          <div className="info-note">
            <span className="info-note-icon">i</span>
            <span><strong>{run.sourceKind === 'SYNTHETIC' ? 'Illustration, not an execution result.' : run.sourceKind === 'NATIVE_LOCAL' ? 'Native local source · not owner-certified.' : 'Real archived review export · not an owner-native TraceStore.'}</strong> {run.note}</span>
          </div>

          {finding && findingVisible && (
            <section className="finding-report" aria-label="Standalone diagnosis report">
              <div className="finding-topline">
                <div>
                  <div className="eyebrow">INDEPENDENT REVIEW SOURCE</div>
                  <h2>{finding.title}</h2>
                </div>
                <button type="button" className="finding-hide" onClick={() => setFindingVisible(false)}>Hide</button>
              </div>
              <p className="finding-caveat">This standalone report is NOT linked to the selected Run. Source assertions only; no Owner sequence, material verification or cross-Owner causal evidence has been established.</p>
              <dl className="finding-fields">
                {finding.fields.map(field => (
                  <React.Fragment key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </React.Fragment>
                ))}
                <dt>Reported binding names</dt>
                <dd>{finding.bindingNames.length ? finding.bindingNames.join(', ') : 'NOT AVAILABLE'}</dd>
                <dt>Full root cause text</dt>
                <dd>{finding.suppressedOriginalText ? 'WITHHELD — use authorized original report' : 'NOT PROVIDED'}</dd>
                <dt>Owner evidence integrity</dt>
                <dd>{finding.evidenceIntegrity}</dd>
              </dl>
              <div className="finding-source">Unversioned local diagnosis · {finding.sourceLocator} · no remote upload or execution controls</div>
            </section>
          )}

          <div className="trace-heading">
            <div>
              <h2>Execution trajectory <span className="trajectory-count">{run.sections.length} sections · {summary.events} source records</span></h2>
              <p>Exact source refs · read-only · display order is not cross-owner causality</p>
            </div>
            <div className="toolbar" aria-label="Trajectory presentation controls">
              <button type="button" className={filter === 'all' ? 'tool active' : 'tool'} onClick={() => setFilter('all')}>All</button>
              <button type="button" className={filter === 'exceptions' ? 'tool active' : 'tool'} onClick={() => setFilter('exceptions')}>Exceptions</button>
              <button type="button" className="tool border-left" onClick={focusUnknown}>Focus unknown</button>
              <button type="button" className="tool" onClick={locateSelected} disabled={!activeRecord}>Locate selected</button>
              <button type="button" className="tool" onClick={() => setExpanded(new Set(run.sections.map(item => item.id)))}>Expand all</button>
              <button type="button" className="tool" onClick={() => setExpanded(new Set())}>Collapse normal</button>
            </div>
          </div>
          <div className="view-selector" role="group" aria-label="Console-inspired trace reading mode">
            {([
              ['readable', 'Readable'], ['model', 'Model only'],
              ['owners', 'All owners'], ['raw', 'Raw records'],
            ] as [ViewMode, string][]).map(([mode, label]) => (
              <button type="button" key={mode} className={'view-mode ' + (viewMode === mode ? 'active' : '')}
                aria-pressed={viewMode === mode} onClick={() => { setViewMode(mode); setFilter('all') }}>{label}</button>
            ))}
          </div>
          <div className="view-hint">
            {viewMode === 'readable' && 'Compact source ledger · folded pairs require explicit refs · display order is not cross-owner sequence or causality.'}
            {viewMode === 'model' && 'Agent/Model owner records only. Runtime omission here is a filter, not missing execution.'}
            {viewMode === 'owners' && 'Unfolded owner-native records in separate lanes. No global cross-owner sequence.'}
            {viewMode === 'raw' && 'Source refs and origin. Diagnostic file lines are not owner-local sequences. Material bodies are never shown automatically.'}
          </div>

          <div className="timeline" aria-label="Read-only execution trajectory">
            {run.sections.map((section, sectionIndex) => {
              const rows = projectSectionRows(run, section, viewMode) as PresentationRow[]
              const shown = filter === 'exceptions' ? rows.filter(row => row.members.some(isException)) : rows
              if (!shown.length) return null
              const isOpen = expanded.has(section.id)
              const containsWarning = section.records.some(isException)
              const useLanes = viewMode === 'owners'
              return (
                <section className={'turn-card ' + (containsWarning ? 'has-warning' : '')} key={section.id}>
                  <button type="button" className="turn-header" onClick={() => toggleSection(section.id)} aria-expanded={isOpen}>
                    <span className="turn-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
                    <span className="turn-title">
                      <strong>{section.title}</strong>
                      <small>{section.subtitle}</small>
                    </span>
                    <span className={'turn-count ' + (containsWarning ? 'turn-count-warning' : '')}>{section.records.length} records{containsWarning ? ' · ' + section.records.filter(isException).length + ' flagged' : ''}</span>
                    <span className="chevron">{isOpen ? '⌄' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className={'turn-body ' + (useLanes ? 'laned' : '') + (viewMode === 'readable' ? ' ledger-body' : '')}>
                      {viewMode === 'readable' ? (
                        <div className="ledger-view" aria-label="Compact source ledger">
                          <div className="ledger-head" aria-hidden="true">
                            <span></span><span>EVENT</span><span>SOURCE / RECORD KIND</span><span>STATUS / POSITION</span>
                          </div>
                          {shown.map(row => renderRecordRow(row))}
                        </div>
                      ) : useLanes ? (
                        <div className="owner-lanes">
                          {projectLanes(shown).map(lane => (
                            <div className={'owner-lane lane-' + lane.id} key={lane.id}>
                              <div className="lane-heading">{lane.label} <span>{lane.rows.length}</span></div>
                              {lane.rows.length ? lane.rows.map((row: PresentationRow) => renderRecordRow(row)) :
                                <div className="lane-empty">NOT REPORTED IN THIS STEP</div>}
                            </div>
                          ))}
                        </div>
                      ) : shown.map(row => renderRecordRow(row))}
                    </div>
                  )}
                </section>
              )
            })}
            {!run.sections.some(section => {
              const rows = projectSectionRows(run, section, viewMode) as PresentationRow[]
              return (filter === 'exceptions' ? rows.filter(row => row.members.some(isException)) : rows).length > 0
            }) && <div className="empty-state">No matching source records in this view. This is a filter result, not an execution conclusion.</div>}
          </div>
          <div className="canvas-footer">{run.sourceKind === 'NATIVE_LOCAL'
            ? 'Local v2 import · browser checks only · owner TraceStore.load_run not executed · no live services.'
            : run.sourceKind === 'REVIEW_DIAGNOSTIC'
            ? 'Actual review-export JSONL · file line order only · no owner sequence, material digest, closure, or external status verification.'
            : 'Synthetic-only sample. Select a local TraceStore v2 folder or archived diagnostic JSONL.'}</div>
        </main>

        <aside className="inspector" aria-label="Source record inspector">
          <div className="inspector-top">
            <span className="eyebrow">INSPECTOR</span>
            <span className="inspector-icon">ⓘ</span>
          </div>
          {activeRecord ? (
            <>
              <div className="inspector-title">{activeRecord.title}</div>
              <section className="reading-context" aria-label="Reading context">
                <div className="reading-context-top">
                  <span>{readingContext.position} / {readingContext.total} in section</span>
                  <button type="button" onClick={returnToSource} disabled={!canReturn}>Back to prior source</button>
                </div>
                <strong>{readingContext.sectionTitle ?? 'NO SECTION'}</strong>
                <p>Neighboring source entries in this section's display order only; not causal, chronological or Owner sequence.</p>
                <div className="reading-actions">
                  <button type="button" aria-label="Previous record"
                    disabled={!readingContext.previous}
                    onClick={() => navigateToRecord(readingContext.previous)}>
                    <span>Previous record</span>
                    <small>{readingContext.previous ? readingContext.previous.kind + ' · ' + readingContext.previous.status : 'Section start'}</small>
                  </button>
                  <button type="button" aria-label="Next record"
                    disabled={!readingContext.next}
                    onClick={() => navigateToRecord(readingContext.next)}>
                    <span>Next record</span>
                    <small>{readingContext.next ? readingContext.next.kind + ' · ' + readingContext.next.status : 'Section end'}</small>
                  </button>
                </div>
              </section>
              <span className={statusClass(activeRecord.status)}>{activeRecord.status}</span>
              <p className="inspector-description">{activeRecord.summary}</p>
              <div className="inspector-tabs" role="group" aria-label="Inspector detail">
                {([
                  ['summary', 'Summary'], ['source', 'Source'], ['links', 'Lineage'],
                ] as [InspectorTab, string][]).map(([tab, label]) => (
                  <button key={tab} type="button" aria-pressed={inspectorTab === tab}
                    className={inspectorTab === tab ? 'inspector-tab active' : 'inspector-tab'}
                    onClick={() => setInspectorTab(tab)}>{label}</button>
                ))}
              </div>
              {inspectorTab === 'summary' && (
                <>
                  <div className="inspector-label">SELECTED SOURCE</div>
                  <dl className="properties">
                    <dt>Authority</dt><dd>{activeRecord.sourceAuthority}</dd>
                    <dt>Record kind</dt><dd>{activeRecord.kind}</dd>
                    <dt>{activeRecord.ownerSequence === null ? 'Review file line' : 'Local sequence'}</dt><dd>{activeRecord.ownerSequence ?? activeRecord.sourceLine ?? 'UNAVAILABLE'}</dd>
                  </dl>
                  {activePresentationRow?.isFolded && (
                    <>
                      <div className="inspector-label">FOLDED INTERACTION</div>
                      <div className="paired-sources">
                        <p>Read-time pairing based on explicit owner refs, never timing.</p>
                        {activePresentationRow.members.map(member => (
                          <button type="button" key={member.ref} onClick={() => navigateToRecord(member, 'source')}>
                            <strong>{member.kind}</strong>
                            <span>{recordPosition(member)} · {member.status}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="inspector-label">EVIDENCE / MATERIAL</div>
                  <div className="raw-placeholder" role="status"><strong>{evidenceStatus.label}</strong><span>{evidenceStatus.detail}</span></div>
                  {canRevealLocalDetail && (
                    <section className="local-detail" aria-label="Local diagnostic detail">
                      <div className="inspector-label">LOCAL DIAGNOSTIC PREVIEW</div>
                      <p>Optional source-line inspection. Only selected scalar fields; never raw diagnostic text, bindings, output, credentials or materials. No upload or persistence.</p>
                      {shownDetail ? (
                        <>
                          <dl className="properties local-detail-fields">
                            {shownDetail.fields.length ? shownDetail.fields.map(field => (
                              <React.Fragment key={field.label}>
                                <dt>{field.label}</dt><dd>{field.value}</dd>
                              </React.Fragment>
                            )) : <><dt>Allowed fields</dt><dd>None available for this record</dd></>}
                            <dt>Evidence refs</dt><dd>{shownDetail.evidenceRefCount ?? 'NOT VERIFIED / NOT PROVIDED'}</dd>
                            <dt>Material</dt><dd>{shownDetail.materialReported ? 'Reported in JSONL · not verified' : 'No material object reported'}</dd>
                          </dl>
                          <button type="button" className="detail-toggle" onClick={hideLocalDetail}>Hide local details</button>
                        </>
                      ) : (
                        <button type="button" className="detail-toggle" onClick={revealLocalDetail} disabled={detailBusy}>
                          {detailBusy ? 'Reading selected line…' : 'Show allowed local fields'}
                        </button>
                      )}
                      {detailError && <p role="alert" className="detail-error">{detailError}</p>}
                    </section>
                  )}
                </>
              )}
              {inspectorTab === 'source' && (
                <>
                  <div className="inspector-label">SOURCE IDENTITY</div>
                  <pre className="source-preview">{JSON.stringify({
                    sourceKind: run.sourceKind, ref: activeRecord.ref,
                    sourceAuthority: activeRecord.sourceAuthority,
                    ownerSequence: activeRecord.ownerSequence,
                    ...(activeRecord.sourceLine ? { sourceLine: activeRecord.sourceLine } : {}),
                    kind: activeRecord.kind, status: activeRecord.status,
                    causalRefs: activeRecord.causalRefs,
                    ...(run.sourceKind !== 'SYNTHETIC' ? {
                      sourceLocator: activeRecord.sourceLocator,
                      stage: activeRecord.stage, materialRef: activeRecord.materialRef ?? null,
                    } : {}),
                  }, null, 2)}</pre>
                  <div className="raw-placeholder"><strong>Provenance subset only</strong><span>Raw material content is not included. The viewer does not transmit files or assert complete owner validation.</span></div>
                  {run.sourceKind === 'REVIEW_DIAGNOSTIC' && (
                    <section className="review-line-context" aria-label="Source file adjacency">
                      <div className="inspector-label">PHYSICAL FILE CONTEXT</div>
                      <p>Adjacent JSONL lines only. File order does not establish causality, Owner sequence or a cross-Run association.</p>
                      <div className="review-line-actions">
                        <button type="button" disabled={!neighbors.previous}
                          onClick={() => goToReviewLine(neighbors.previous)}>
                          Previous line{neighbors.previous ? ' · ' + neighbors.previous.sourceLine : ''}
                        </button>
                        <button type="button" disabled={!neighbors.next}
                          onClick={() => goToReviewLine(neighbors.next)}>
                          Next line{neighbors.next ? ' · ' + neighbors.next.sourceLine : ''}
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
              {inspectorTab === 'links' && (
                <>
                  <div className="inspector-label">EXPLICIT CAUSAL REFS</div>
                  {causalLinks.length ? (
                    <div className="ref-list">{causalLinks.map((link: { ref: string; target: TraceRecord | null }) => (
                      <button type="button" key={link.ref} className="ref-item"
                        onClick={() => navigateToRecord(link.target, 'source')}
                        disabled={!link.target}>
                        <span>↳</span><span className="mono">{link.ref}</span>
                        <small>{link.target ? 'VIEW SOURCE' : 'UNAVAILABLE'}</small>
                      </button>
                    ))}</div>
                  ) : <p className="unavailable">No explicit causal refs declared. No relationship is inferred.</p>}
                </>
              )}
            </>
          ) : <p className="unavailable">Select a record for provenance.</p>}
          <div className="inspector-bottom">SOURCE-FIRST · NO EXECUTION CONTROLS</div>
        </aside>
      </div>
    </div>
  )
}

const element = document.getElementById('root')
if (!element) throw new Error('Trace Viewer root element is missing')
createRoot(element).render(<App />)
