import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { samples } from './fixtures.mjs'
import { allRecords, defaultOpenSections, getSourceLinks, isException, runSummary } from './projection.mjs'
import { findPrimaryUnknown, projectLanes, projectSectionRows } from './console-parity.mjs'

type TraceRecord = {
  ref: string
  sourceAuthority: string
  ownerSequence: number
  kind: string
  title: string
  summary: string
  status: string
  causalRefs: string[]
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
type ViewMode = 'readable' | 'model' | 'owners' | 'raw'
type InspectorTab = 'summary' | 'source' | 'links'
type ExampleRun = {
  id: string
  sourceKind: 'SYNTHETIC'
  mode: string
  title: string
  subtitle: string
  note: string
  sections: Section[]
}
const runs = samples as unknown as ExampleRun[]

function statusClass(status: string): string {
  if (['FAILED', 'BLOCKED', 'OUTCOME_UNKNOWN', 'RESULT_UNKNOWN', 'UNRESOLVED', 'DENIED', 'SAFE_STOPPED'].includes(status)) return 'status danger'
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
  const [runId, setRunId] = useState(runs[0].id)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultOpenSections(runs[0])))
  const [selectedRef, setSelectedRef] = useState<string>(runs[0].sections[1].records[2].ref)
  const [filter, setFilter] = useState<'all' | 'exceptions'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('readable')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('summary')
  const run = runs.find(item => item.id === runId) ?? runs[0]
  const records = allRecords(run) as TraceRecord[]
  const activeRecord = records.find(record => record.ref === selectedRef) ?? null
  const summary = runSummary(run)
  const causalLinks = activeRecord ? getSourceLinks(run, activeRecord) : []
  const activePresentationRow = run.sections.flatMap(section =>
    projectSectionRows(run, section, viewMode) as PresentationRow[]
  ).find(row => row.members.some(member => member.ref === selectedRef)) ?? null

  function focusUnknown() {
    const record = findPrimaryUnknown(run) as TraceRecord | null
    if (!record) return
    setFilter('exceptions')
    setViewMode('readable')
    const containing = run.sections.find(section => section.records.some(item => item.ref === record.ref))
    if (containing) setExpanded(previous => new Set(previous).add(containing.id))
    setSelectedRef(record.ref)
    setInspectorTab('summary')
  }

  function selectRecord(ref: string) {
    setSelectedRef(ref)
    setInspectorTab('summary')
  }

  function renderRecordRow(row: PresentationRow) {
    const active = row.members.some(member => member.ref === selectedRef)
    const source = row.source
    const terminal = row.members[row.members.length - 1]
    const warning = row.members.some(isException)
    return (
      <button key={row.key} type="button"
        className={'trace-event ' + (active ? 'selected' : '')}
        onClick={() => selectRecord(source.ref)} aria-pressed={active}>
        <span className={'event-glyph ' + (warning ? 'glyph-warning' : '')}>{kindSymbol(source.kind)}</span>
        <span className="event-detail">
          <span className="event-meta">{viewMode === 'raw' ? 'SOURCE RECORD' : row.label} <span>·</span> {source.sourceAuthority}</span>
          <strong>{viewMode === 'raw' ? source.kind : source.title}</strong>
          <small>{viewMode === 'raw' ? source.ref : source.summary}</small>
          {row.isFolded && <span className="fold-source-refs">{row.members.map(member => member.kind + ' · seq ' + member.ownerSequence).join('  →  ')}</span>}
        </span>
        <span className="event-side">
          <span className={statusClass(terminal.status)}>{terminal.status}</span>
          <small>{row.isFolded ? row.members.length + ' exact sources' : 'seq ' + source.ownerSequence}</small>
        </span>
      </button>
    )
  }

  function selectRun(next: ExampleRun) {
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
        <span className="build-badge">D0 · PREVIEW</span>
        <span className="synthetic-badge">SYNTHETIC DATA</span>
      </header>

      <div className="workbench">
        <aside className="sidebar" aria-label="Run explorer">
          <div className="sidebar-heading">EXPLORER</div>
          <div className="sidebar-caption">RUN EXAMPLES <span>{runs.length}</span></div>
          <div className="run-list">
            {runs.map(item => (
              <button key={item.id} type="button" className={'run-option ' + (item.id === run.id ? 'active' : '')} onClick={() => selectRun(item)} aria-pressed={item.id === run.id}>
                <span className="run-option-icon">{item.mode === 'DETERMINISTIC' ? '◇' : '◆'}</span>
                <span className="run-option-copy">
                  <strong>{item.title}</strong>
                  <small>{item.mode === 'DETERMINISTIC' ? 'Deterministic · No Model' : 'Agent / Model · Synthetic'}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="sidebar-divider" />
          <div className="sidebar-caption">THIS RUN</div>
          <div className="section-index">
            {run.sections.map((section, i) => (
              <button key={section.id} type="button" onClick={() => { setExpanded(previous => new Set(previous).add(section.id)); setSelectedRef(section.records[0]?.ref ?? '') }}>
                <span className="section-index-num">{String(i + 1).padStart(2, '0')}</span>
                <span>{section.title.replace(/^TURN \d+ · |^STEP \d+ · |^ENTRY · |^EXECUTION · |^EXTERNAL · /, '')}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <span className="indicator" />
            <span>Read-only • local examples</span>
          </div>
        </aside>

        <main className="canvas">
          <div className="breadcrumb">WORKSPACE <span>/</span> TRACE <span>/</span> {run.mode}</div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">RUN OVERVIEW</div>
              <h1>{run.title}</h1>
              <p>{run.subtitle}</p>
            </div>
          </div>

          <div className="metric-row">
            <div className="metric"><span>Execution mode</span><strong>{run.mode === 'DETERMINISTIC' ? 'Deterministic' : 'Agent / Model'}</strong></div>
            <div className="metric"><span>Visible records</span><strong>{summary.events}</strong></div>
            <div className="metric"><span>Owner streams</span><strong>{summary.ownerStreams}</strong></div>
            <div className="metric"><span>Exception flags</span><strong className="warning-text">{summary.exceptions}</strong></div>
          </div>

          <div className="info-note">
            <span className="info-note-icon">i</span>
            <span><strong>Illustration, not an execution result.</strong> {run.note}</span>
          </div>

          <div className="trace-heading">
            <div>
              <h2>Execution trajectory</h2>
              <p>Console-inspired reading modes · exact source refs · read-only</p>
            </div>
            <div className="toolbar" aria-label="Trajectory presentation controls">
              <button type="button" className={filter === 'all' ? 'tool active' : 'tool'} onClick={() => setFilter('all')}>All</button>
              <button type="button" className={filter === 'exceptions' ? 'tool active' : 'tool'} onClick={() => setFilter('exceptions')}>Exceptions</button>
              <button type="button" className="tool border-left" onClick={focusUnknown}>Focus unknown</button>
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
            {viewMode === 'readable' && 'Paired Model/Tool interactions are presentation-only; Runtime and external facts remain separate.'}
            {viewMode === 'model' && 'Agent/Model owner records only. Runtime omission here is a filter, not missing execution.'}
            {viewMode === 'owners' && 'Unfolded owner-native records in separate lanes. No global cross-owner sequence.'}
            {viewMode === 'raw' && 'Source refs, kinds and owner-local sequences. Raw materials are not included in these synthetic fixtures.'}
          </div>

          <div className="timeline" aria-label="Read-only execution trajectory">
            {run.sections.map((section, sectionIndex) => {
              const rows = projectSectionRows(run, section, viewMode) as PresentationRow[]
              const shown = filter === 'exceptions' ? rows.filter(row => row.members.some(isException)) : rows
              if (!shown.length) return null
              const isOpen = expanded.has(section.id)
              const containsWarning = section.records.some(isException)
              const useLanes = viewMode === 'readable' || viewMode === 'owners'
              return (
                <section className={'turn-card ' + (containsWarning ? 'has-warning' : '')} key={section.id}>
                  <button type="button" className="turn-header" onClick={() => toggleSection(section.id)} aria-expanded={isOpen}>
                    <span className="turn-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
                    <span className="turn-title">
                      <strong>{section.title}</strong>
                      <small>{section.subtitle}</small>
                    </span>
                    <span className={'turn-count ' + (containsWarning ? 'turn-count-warning' : '')}>{section.records.length} owner records</span>
                    <span className="chevron">{isOpen ? '⌄' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className={'turn-body ' + (useLanes ? 'laned' : '')}>
                      {useLanes ? (
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
          <div className="canvas-footer">D1 will add native TraceRun import. No live owner APIs are connected in D0.</div>
        </main>

        <aside className="inspector" aria-label="Source record inspector">
          <div className="inspector-top">
            <span className="eyebrow">INSPECTOR</span>
            <span className="inspector-icon">ⓘ</span>
          </div>
          {activeRecord ? (
            <>
              <div className="inspector-title">{activeRecord.title}</div>
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
                    <dt>Local sequence</dt><dd>{activeRecord.ownerSequence}</dd>
                  </dl>
                  {activePresentationRow?.isFolded && (
                    <>
                      <div className="inspector-label">FOLDED INTERACTION</div>
                      <div className="paired-sources">
                        <p>Read-time pairing based on explicit owner refs, never timing.</p>
                        {activePresentationRow.members.map(member => (
                          <button type="button" key={member.ref} onClick={() => { setSelectedRef(member.ref); setInspectorTab('source') }}>
                            <strong>{member.kind}</strong>
                            <span>seq {member.ownerSequence} · {member.status}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="inspector-label">EVIDENCE / MATERIAL</div>
                  <div className="raw-placeholder"><strong>UNAVAILABLE — synthetic fixture</strong><span>No real source material, model snapshot or evidence closure was loaded.</span></div>
                </>
              )}
              {inspectorTab === 'source' && (
                <>
                  <div className="inspector-label">SOURCE IDENTITY</div>
                  <pre className="source-preview">{JSON.stringify({
                    sourceKind: 'SYNTHETIC', ref: activeRecord.ref,
                    sourceAuthority: activeRecord.sourceAuthority,
                    ownerSequence: activeRecord.ownerSequence,
                    kind: activeRecord.kind, status: activeRecord.status,
                    causalRefs: activeRecord.causalRefs,
                  }, null, 2)}</pre>
                  <div className="raw-placeholder"><strong>Presentation-only snapshot</strong><span>This is a safe subset of the authored fixture, not raw owner-native bytes.</span></div>
                </>
              )}
              {inspectorTab === 'links' && (
                <>
                  <div className="inspector-label">EXPLICIT CAUSAL REFS</div>
                  {causalLinks.length ? (
                    <div className="ref-list">{causalLinks.map((link: { ref: string; target: TraceRecord | null }) => (
                      <button type="button" key={link.ref} className="ref-item"
                        onClick={() => { if (link.target) { setFilter('all'); setViewMode('owners'); const section = run.sections.find(item => item.records.some(record => record.ref === link.ref)); if (section) setExpanded(previous => new Set(previous).add(section.id)); setSelectedRef(link.ref) } }}
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
