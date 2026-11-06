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
type MainMenu = 'file' | 'view' | 'navigate' | 'help'
type HelpTopic = 'quick' | 'semantics' | 'about'
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

const DEFAULT_INSPECTOR_WIDTH = 380
const MIN_INSPECTOR_WIDTH = 300
const MAX_INSPECTOR_WIDTH = 640
const MIN_TRACE_WIDTH = 480

function readInspectorWidth(): number {
  try {
    const saved = Number(window.localStorage.getItem('trace-viewer:inspector-width'))
    if (Number.isInteger(saved) && saved >= MIN_INSPECTOR_WIDTH && saved <= MAX_INSPECTOR_WIDTH) return saved
  } catch {
    // Private browsing or browser policy may disable local storage.
  }
  return DEFAULT_INSPECTOR_WIDTH
}

function App() {
  const [nativeRun, setNativeRun] = useState<ExampleRun | null>(null)
  const [reviewRun, setReviewRun] = useState<ExampleRun | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [finding, setFinding] = useState<ReviewFinding | null>(null)
  const [findingVisible, setFindingVisible] = useState(false)
  const [findingError, setFindingError] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<MainMenu | null>(null)
  const [inspectorVisible, setInspectorVisible] = useState(true)
  const [inspectorWidth, setInspectorWidth] = useState(readInspectorWidth)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [inspectorResizing, setInspectorResizing] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null)
  const menuBarRef = useRef<HTMLElement | null>(null)
  const workbenchRef = useRef<HTMLDivElement | null>(null)
  const inspectorPointer = useRef<number | null>(null)
  const directoryRef = useRef<HTMLInputElement | null>(null)
  const reviewInputRef = useRef<HTMLInputElement | null>(null)
  const findingInputRef = useRef<HTMLInputElement | null>(null)
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
      setSidebarOpen(new Set(imported.sections.slice(0,1).map(s => s.id)))
      setSidebarShowAll(new Set())
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

  const [sidebarOpen, setSidebarOpen] = useState<Set<string>>(() => new Set([syntheticRuns[0].sections[1]?.id].filter(Boolean) as string[]))
  const [sidebarShowAll, setSidebarShowAll] = useState<Set<string>>(() => new Set())
  const [runId, setRunId] = useState(syntheticRuns[0].id)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultOpenSections(syntheticRuns[0])))
  const [selectedRef, setSelectedRef] = useState<string>(syntheticRuns[0].sections[1].records[2].ref)
  // At compact widths the Inspector moves below the Trace; the vertical
  // splitter only exists on three-column desktop layouts.
  const maxInspectorWidth = Math.max(MIN_INSPECTOR_WIDTH,
    Math.min(MAX_INSPECTOR_WIDTH, viewportWidth - 234 - MIN_TRACE_WIDTH))
  const effectiveInspectorWidth = Math.min(inspectorWidth, maxInspectorWidth)
  function resizeInspector(next: number) {
    const bounded = Math.max(MIN_INSPECTOR_WIDTH, Math.min(maxInspectorWidth, Math.round(next)))
    setInspectorWidth(bounded)
    try {
      window.localStorage.setItem('trace-viewer:inspector-width', String(bounded))
    } catch {
      // Dragging remains functional without persistence.
    }
  }
  function onInspectorPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    inspectorPointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setInspectorResizing(true)
  }
  function onInspectorPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (inspectorPointer.current !== event.pointerId) return
    const edge = workbenchRef.current?.getBoundingClientRect().right
    if (edge !== undefined) resizeInspector(edge - event.clientX)
  }
  function finishInspectorResize(event: React.PointerEvent<HTMLDivElement>) {
    if (inspectorPointer.current !== event.pointerId) return
    onInspectorPointerMove(event)
    inspectorPointer.current = null
    setInspectorResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  function onInspectorResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: number
    switch (event.key) {
      case 'ArrowLeft': next = effectiveInspectorWidth + 16; break
      case 'ArrowRight': next = effectiveInspectorWidth - 16; break
      case 'Home': next = MIN_INSPECTOR_WIDTH; break
      case 'End': next = maxInspectorWidth; break
      default: return
    }
    event.preventDefault()
    resizeInspector(next)
  }
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    if (directoryRef.current) directoryRef.current.webkitdirectory = true
  }, [])
  useEffect(() => {
    const dismissOnOutsideClick = (event: MouseEvent) => {
      if (!menuBarRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
        setHelpTopic(null)
      }
    }
    document.addEventListener('pointerdown', dismissOnOutsideClick)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsideClick)
      document.removeEventListener('keydown', dismissOnEscape)
    }
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
      setSidebarOpen(new Set(imported.sections.slice(0,1).map(section => section.id)))
      setSidebarShowAll(new Set())
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
  useEffect(() => {
    const section = run.sections.find(section => section.records.some(record => record.ref === selectedRef))
    if (section) setSidebarOpen(previous => previous.has(section.id) ? previous : new Set(previous).add(section.id))
  }, [runId, selectedRef])
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
        {isLedger ? (
          <>
            <span className="ledger-event-main" title={source.title + ' · ' + source.summary}>
              <strong>{source.title}</strong>
              <small>{source.summary}</small>
            </span>
            <span className="ledger-kind" title={row.isFolded ? row.label + ' · ' + source.kind : source.kind}>
              {row.isFolded ? row.label + ' · ' + source.kind : source.kind}
            </span>
            <span className="ledger-source" title={source.sourceAuthority + ' · ' + source.ref}>
              <span className="ledger-authority">{source.sourceAuthority}{source.stage ? ' · ' + source.stage : ''}</span>
              <span className="ledger-ref">{source.ref}</span>
              {(source.causalRefs?.length ?? 0) > 0 && <span className="ledger-ref-count" title={source.causalRefs.length + ' declared causal refs'}>↳{source.causalRefs.length}</span>}
            </span>
          </>
        ) : (
          <span className="event-detail">
            <span className="event-meta">{viewMode === 'raw' ? 'SOURCE RECORD' : row.label} <span>·</span> {source.sourceAuthority}{viewMode !== 'raw' && <span className="event-kind"> · {source.kind}</span>}</span>
            <strong>{viewMode === 'raw' ? source.kind : source.title}</strong>
            <small>{viewMode === 'raw' ? source.ref : source.summary}</small>
            {row.isFolded && <span className="fold-source-refs">{row.members.map(member => member.kind + ' · ' + recordPosition(member)).join('  →  ')}</span>}
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
    setSidebarOpen(new Set((next.sections.filter(section => section.records.some(isException)).slice(0,1).length
      ? next.sections.filter(section => section.records.some(isException)).slice(0,1)
      : next.sections.slice(0,1)).map(section => section.id)))
    setSidebarShowAll(new Set())
    setExpanded(new Set(defaultOpenSections(next)))
    setFilter('all')
    setViewMode('readable')
    setInspectorTab('summary')
    const recordsForRun = allRecords(next) as TraceRecord[]
    setSelectedRef((recordsForRun.find(isException) ?? recordsForRun[0])?.ref ?? '')
  }

  function applyViewMode(mode: ViewMode) {
    setViewMode(mode)
    setFilter('all')
    setOpenMenu(null)
  }
  function runMenuAction(action: () => void) {
    setOpenMenu(null)
    action()
  }
  function toggleMenu(menu: MainMenu) {
    setOpenMenu(previous => previous === menu ? null : menu)
  }
  function menuKeyboardNavigation(event: React.KeyboardEvent<HTMLElement>) {
    if (!openMenu || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = Array.from(menuBarRef.current?.querySelectorAll<HTMLButtonElement>('[role="menu"] button:not(:disabled)') ?? [])
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown'
      ? (index + 1) % buttons.length
      : (index <= 0 ? buttons.length - 1 : index - 1)
    buttons[next].focus()
    event.preventDefault()
  }
  function toggleSidebarSection(id: string) {
    setSidebarOpen(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleSidebarShowAll(id: string) {
    setSidebarShowAll(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
        <nav className="app-menus" aria-label="Application menus" ref={menuBarRef} onKeyDown={menuKeyboardNavigation}>
          <div className="app-menu">
            <button type="button" className={'app-menu-trigger ' + (openMenu === 'file' ? 'active' : '')}
              aria-haspopup="menu" aria-expanded={openMenu === 'file'} onClick={() => toggleMenu('file')}>File</button>
            {openMenu === 'file' && (
              <div className="app-menu-panel" role="menu" aria-label="File menu">
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => directoryRef.current?.click())}>Open TraceStore v2 folder</button>
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => reviewInputRef.current?.click())}>Open archived diagnostic JSONL</button>
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => findingInputRef.current?.click())}>Open standalone diagnosis JSON</button>
                <div className="app-menu-note">Read-only · files stay in this browser</div>
              </div>
            )}
          </div>
          <div className="app-menu">
            <button type="button" className={'app-menu-trigger ' + (openMenu === 'view' ? 'active' : '')}
              aria-haspopup="menu" aria-expanded={openMenu === 'view'} onClick={() => toggleMenu('view')}>View</button>
            {openMenu === 'view' && (
              <div className="app-menu-panel" role="menu" aria-label="View menu">
                {([
                  ['readable', 'Readable ledger'], ['owners', 'All owners'],
                  ['model', 'Model only'], ['raw', 'Raw records'],
                ] as [ViewMode, string][]).map(([mode, label]) => (
                  <button key={mode} type="button" role="menuitemradio" aria-checked={viewMode === mode}
                    onClick={() => applyViewMode(mode)}><span>{label}</span><span className="menu-check" aria-hidden="true">{viewMode === mode ? '✓' : ''}</span></button>
                ))}
                <div className="app-menu-separator" />
                <button type="button" role="menuitemcheckbox" aria-checked={inspectorVisible}
                  onClick={() => runMenuAction(() => setInspectorVisible(value => !value))}>
                  <span>Show Inspector</span><span className="menu-check" aria-hidden="true">{inspectorVisible ? '✓' : ''}</span>
                </button>
              </div>
            )}
          </div>
          <div className="app-menu">
            <button type="button" className={'app-menu-trigger ' + (openMenu === 'navigate' ? 'active' : '')}
              aria-haspopup="menu" aria-expanded={openMenu === 'navigate'} onClick={() => toggleMenu('navigate')}>Navigate</button>
            {openMenu === 'navigate' && (
              <div className="app-menu-panel" role="menu" aria-label="Navigate menu">
                <button type="button" role="menuitem" disabled={!findPrimaryUnknown(run)}
                  onClick={() => runMenuAction(focusUnknown)}>Focus unknown</button>
                <button type="button" role="menuitem" disabled={!activeRecord}
                  onClick={() => runMenuAction(locateSelected)}>Locate selected</button>
                <div className="app-menu-separator" />
                <button type="button" role="menuitem"
                  onClick={() => runMenuAction(() => setExpanded(new Set(run.sections.map(item => item.id))))}>Expand all</button>
                <button type="button" role="menuitem"
                  onClick={() => runMenuAction(() => setExpanded(new Set()))}>Collapse all sections</button>
              </div>
            )}
          </div>
          <div className="app-menu">
            <button type="button" className={'app-menu-trigger ' + (openMenu === 'help' ? 'active' : '')}
              aria-haspopup="menu" aria-expanded={openMenu === 'help'} onClick={() => toggleMenu('help')}>Help</button>
            {openMenu === 'help' && (
              <div className="app-menu-panel" role="menu" aria-label="Help menu">
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => setHelpTopic('quick'))}>Quick start</button>
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => setHelpTopic('semantics'))}>Trace semantics</button>
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => setHelpTopic('about'))}>About Trace Viewer</button>
              </div>
            )}
          </div>
        </nav>
        <div className="topbar-spacer" />
        <span className="build-badge">LOCAL WORKBENCH · DEMO</span>
        <span className="synthetic-badge">{run.sourceKind === 'SYNTHETIC' ? 'SYNTHETIC DATA'
          : run.sourceKind === 'NATIVE_LOCAL' ? 'LOCAL NATIVE · NOT OWNER VERIFIED'
          : 'ARCHIVED DIAGNOSTIC · NOT OWNER NATIVE'}</span>
      </header>
      <div className="file-inputs" aria-label="Local file inputs">
        <input ref={directoryRef} id="native-directory" type="file" multiple
          aria-label="Import TraceStore v2 directory" onChange={importDirectory} />
        <input ref={reviewInputRef} id="review-jsonl" type="file" accept=".jsonl"
          aria-label="Import archived diagnostic JSONL" onChange={importReview} />
        <input ref={findingInputRef} id="review-finding-json" type="file" accept=".json"
          aria-label="Import standalone diagnosis JSON" onChange={importFinding} />
      </div>

      <div ref={workbenchRef}
        className={'workbench' + (inspectorVisible ? '' : ' inspector-hidden') + (inspectorResizing ? ' resizing-inspector' : '')}
        style={{'--inspector-width': effectiveInspectorWidth + 'px'} as React.CSSProperties}>
        <aside className="sidebar" aria-label="Run explorer">
          <div className="sidebar-heading">EXPLORER</div>
          <div className="sidebar-caption">LOCAL RUNS <span>{importedRuns.length}</span></div>
          <div className="import-feedback" aria-live="polite">
            {importing && <p className="import-progress">Reading local files…</p>}
            {finding && <button type="button" className="finding-open-control"
              onClick={() => setFindingVisible(value => !value)}>
              {findingVisible ? 'Hide standalone finding' : 'View standalone finding'}
            </button>}
            {findingError && <p role="alert" className="import-error">{findingError}</p>}
            {importError && <p role="alert" className="import-error">{importError}</p>}
          </div>
          <div className="run-list">
            {importedRuns.length === 0 && (
              <p className="run-empty">No local runs. Use File → Open to inspect local traces, or choose an example below.</p>
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
          <div className="sidebar-caption">THIS RUN <span>{run.sections.length} SECTIONS</span></div>
          <div className="sidebar-run-summary">
            <strong title={run.title}>{run.title}</strong>
            <span>{summary.events} source records <span className="sidebar-summary-dot">·</span> {summary.exceptions} flagged</span>
          </div>
          <nav className="section-index" aria-label="Current run records">
            {run.sections.map((section, i) => {
              const isOpen = sidebarOpen.has(section.id)
              const isActive = section.records.some(record => record.ref === selectedRef)
              const exceptionCount = section.records.filter(isException).length
              const showAll = sidebarShowAll.has(section.id)
              const shownRecords = showAll ? section.records : [
                ...section.records.slice(0, 8),
                ...section.records.slice(8).filter(record => record.ref === selectedRef),
              ]
              return (
                <div key={section.id} className={'sidebar-section ' + (isActive ? 'sidebar-section-active' : '')}>
                  <div className="sidebar-section-row">
                    <button type="button" className="sidebar-section-toggle"
                      aria-label={(isOpen ? 'Collapse ' : 'Expand ') + section.title}
                      aria-expanded={isOpen} onClick={() => toggleSidebarSection(section.id)}>
                      {isOpen ? '⌄' : '›'}
                    </button>
                    <button type="button" className="sidebar-section-link"
                      onClick={() => navigateToRecord(section.records[0] ?? null)}
                      title={section.title}>
                      <span className="section-index-num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="sidebar-section-title">{section.title.replace(/^TURN \d+ · |^STEP \d+ · |^ENTRY · |^EXECUTION · |^EXTERNAL · /, '')}</span>
                      <span className={'sidebar-section-count ' + (exceptionCount ? 'has-exceptions' : '')}
                        title={exceptionCount ? exceptionCount + ' flagged in ' + section.records.length + ' records' : section.records.length + ' records'}>
                        {section.records.length}{exceptionCount ? ' !' + exceptionCount : ''}
                      </span>
                    </button>
                  </div>
                  {isOpen && (
                    <div className="sidebar-record-tree">
                      {shownRecords.map(record => (
                        <button key={record.ref} type="button"
                          className={'sidebar-record ' + (record.ref === selectedRef ? 'active' : '')}
                          onClick={() => navigateToRecord(record)}
                          aria-current={record.ref === selectedRef ? 'true' : undefined}
                          title={record.kind + ' · ' + record.title + ' · ' + record.ref}>
                          <span className={'sidebar-record-glyph ' + (isException(record) ? 'warning' : '')}>{kindSymbol(record.kind)}</span>
                          <span className="sidebar-record-title">{record.title || record.kind}</span>
                          <span className={'sidebar-record-status ' + (isException(record) ? 'warning' : '')}>{record.status}</span>
                        </button>
                      ))}
                      {section.records.length > 8 && (
                        <button type="button" className="sidebar-record-more"
                          onClick={() => toggleSidebarShowAll(section.id)}>
                          {showAll ? 'Show fewer' : 'Show ' + (section.records.length - 8) + ' more records'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
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
          <div className="page-heading" aria-label="Run overview">
            <span className="eyebrow" title={'Run mode: ' + run.mode}>RUN OVERVIEW</span>
            <h1 title={run.title}>{run.title}</h1>
            <span className="page-heading-separator" aria-hidden="true">·</span>
            <p title={run.subtitle}>{run.subtitle}</p>
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
                            <span></span><span>EVENT · SUMMARY</span><span>KIND</span><span>SOURCE / REF</span><span>STATUS · POSITION</span>
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

        {inspectorVisible && (
          <div className="inspector-resizer" role="separator" tabIndex={0}
            aria-label="Resize Inspector width" aria-controls="source-record-inspector"
            aria-orientation="vertical" aria-valuemin={MIN_INSPECTOR_WIDTH}
            aria-valuemax={maxInspectorWidth} aria-valuenow={effectiveInspectorWidth}
            aria-valuetext={effectiveInspectorWidth + ' pixels'}
            title="Drag to resize Inspector · Arrow keys adjust · Double-click resets"
            onPointerDown={onInspectorPointerDown}
            onPointerMove={onInspectorPointerMove}
            onPointerUp={finishInspectorResize}
            onPointerCancel={finishInspectorResize}
            onLostPointerCapture={() => { inspectorPointer.current = null; setInspectorResizing(false) }}
            onKeyDown={onInspectorResizeKeyDown}
            onDoubleClick={() => resizeInspector(DEFAULT_INSPECTOR_WIDTH)} />
        )}
        <aside id="source-record-inspector" className="inspector" aria-label="Source record inspector">
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
      <footer className="app-statusbar" aria-label="Workbench status">
        <span className="statusbar-source"><span className="statusbar-dot" />{run.sourceKind === 'SYNTHETIC' ? 'SYNTHETIC EXAMPLE' : run.sourceKind === 'NATIVE_LOCAL' ? 'LOCAL NATIVE · UNVERIFIED' : 'ARCHIVED DIAGNOSTIC'}</span>
        <span className="statusbar-privacy">READ ONLY · BROWSER LOCAL</span>
        <span className="statusbar-selected" title={activeRecord ? activeRecord.ref : 'No selected record'}>
          {activeRecord ? activeRecord.kind + ' · ' + activeRecord.sourceAuthority + ' · ' + recordPosition(activeRecord) : 'NO SOURCE SELECTED'}
        </span>
        <span className="statusbar-count">{summary.events} records · {summary.exceptions} flagged</span>
      </footer>
      {helpTopic && (
        <div className="help-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setHelpTopic(null) }}>
          <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title">
            <header>
              <h2 id="help-dialog-title">{helpTopic === 'quick' ? 'Quick start' : helpTopic === 'semantics' ? 'Trace semantics' : 'About Trace Viewer'}</h2>
              <button type="button" aria-label="Close help" onClick={() => setHelpTopic(null)} autoFocus>×</button>
            </header>
            {helpTopic === 'quick' && (
              <div className="help-content">
                <p>Use <strong>File</strong> to open a local TraceStore v2 folder, archived diagnostic JSONL, or a standalone diagnosis JSON. Files remain in your browser; this Demo has no server upload.</p>
                <p>Pick a local Run in the Explorer or a synthetic example at the bottom. Use <strong>View</strong> to switch between the compact Readable ledger, separated owner lanes, Model-only records, and raw source rows.</p>
                <p>Select any record to inspect provenance, source identity, and explicitly declared links. Use <strong>Navigate</strong> to find unknown outcomes and jump to the exact source.</p>
              </div>
            )}
            {helpTopic === 'semantics' && (
              <div className="help-content">
                <p><strong>Source-first, not inferred causality.</strong> Rows can be projected or folded for reading, but only explicit source references establish declared links. Display order never implies cross-owner execution order.</p>
                <p>Native local sources are not Owner-certified by this browser; archived JSONL file lines are not Owner-local sequences. Synthetic examples are illustrations only, not execution evidence.</p>
                <p>Materials, private payloads and raw diagnostic bodies are not displayed automatically. Use the Inspector to see the supported source and evidence subset.</p>
              </div>
            )}
            {helpTopic === 'about' && (
              <div className="help-content">
                <p>Trace Viewer is a read-only ConnectionAgent execution-trace inspection Demo using React, TypeScript and a static Web build.</p>
                <p>It currently works with browser-local imports and built-in synthetic examples. A local server or native desktop shell is not part of this version.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

const element = document.getElementById('root')
if (!element) throw new Error('Trace Viewer root element is missing')
createRoot(element).render(<App />)
