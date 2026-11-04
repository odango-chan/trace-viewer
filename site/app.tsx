import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { samples } from './fixtures.mjs'
import { allRecords, defaultOpenSections, getSourceLinks, isException, runSummary } from './projection.mjs'

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
  if (['FAILED', 'BLOCKED', 'OUTCOME_UNKNOWN', 'UNRESOLVED'].includes(status)) return 'status danger'
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
  const run = runs.find(item => item.id === runId) ?? runs[0]
  const records = allRecords(run) as TraceRecord[]
  const activeRecord = records.find(record => record.ref === selectedRef) ?? null
  const summary = runSummary(run)
  const causalLinks = activeRecord ? getSourceLinks(run, activeRecord) : []

  function selectRun(next: ExampleRun) {
    setRunId(next.id)
    setExpanded(new Set(defaultOpenSections(next)))
    setFilter('all')
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
                  <strong>{item.mode === 'DETERMINISTIC' ? 'Frozen Procedure' : 'Agent & Harness'}</strong>
                  <small>{item.mode === 'DETERMINISTIC' ? 'No model calls' : 'Uncertainty / Reconcile'}</small>
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
              <p>Owner-native references · DSH-inspired folding · explicit causal links only</p>
            </div>
            <div className="toolbar">
              <button type="button" className={filter === 'all' ? 'tool active' : 'tool'} onClick={() => setFilter('all')}>All</button>
              <button type="button" className={filter === 'exceptions' ? 'tool active' : 'tool'} onClick={() => setFilter('exceptions')}>Exceptions</button>
              <button type="button" className="tool border-left" onClick={() => setExpanded(new Set(run.sections.map(item => item.id)))}>Expand</button>
              <button type="button" className="tool" onClick={() => setExpanded(new Set())}>Collapse</button>
            </div>
          </div>

          <div className="timeline" aria-label="Read-only execution trajectory">
            {run.sections.map((section, sectionIndex) => {
              const shown = filter === 'exceptions' ? section.records.filter(isException) : section.records
              if (filter === 'exceptions' && shown.length === 0) return null
              const isOpen = expanded.has(section.id)
              const containsWarning = section.records.some(isException)
              return (
                <section className={'turn-card ' + (containsWarning ? 'has-warning' : '')} key={section.id}>
                  <button type="button" className="turn-header" onClick={() => toggleSection(section.id)} aria-expanded={isOpen}>
                    <span className="turn-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
                    <span className="turn-title">
                      <strong>{section.title}</strong>
                      <small>{section.subtitle}</small>
                    </span>
                    <span className={'turn-count ' + (containsWarning ? 'turn-count-warning' : '')}>{section.records.length} records</span>
                    <span className="chevron">{isOpen ? '⌄' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className="turn-body">
                      {shown.map((record, recordIndex) => (
                        <button key={record.ref} type="button" className={'trace-event ' + (activeRecord?.ref === record.ref ? 'selected' : '')} onClick={() => setSelectedRef(record.ref)} aria-pressed={activeRecord?.ref === record.ref}>
                          <span className={'event-glyph ' + (isException(record) ? 'glyph-warning' : '')}>{kindSymbol(record.kind)}</span>
                          <span className="event-detail">
                            <span className="event-meta">{record.kind.replaceAll('_', ' ')} <span>·</span> {record.sourceAuthority}</span>
                            <strong>{record.title}</strong>
                            <small>{record.summary}</small>
                          </span>
                          <span className="event-side">
                            <span className={statusClass(record.status)}>{record.status}</span>
                            <small>seq {record.ownerSequence}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            {filter === 'exceptions' && !run.sections.some(section => section.records.some(isException)) && <div className="empty-state">No exception flags in this synthetic example.</div>}
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
              <div className="inspector-label">SOURCE RECORD</div>
              <dl className="properties">
                <dt>Authority</dt><dd>{activeRecord.sourceAuthority}</dd>
                <dt>Record kind</dt><dd>{activeRecord.kind}</dd>
                <dt>Local sequence</dt><dd>{activeRecord.ownerSequence}</dd>
                <dt>Source ref</dt><dd className="mono">{activeRecord.ref}</dd>
              </dl>
              <div className="inspector-label">EXPLICIT CAUSAL REFS</div>
              {causalLinks.length ? (
                <div className="ref-list">{causalLinks.map((link: { ref: string; target: TraceRecord | null }) => (
                  <button type="button" key={link.ref} className="ref-item" onClick={() => { if (link.target) { setFilter('all'); const section = run.sections.find(item => item.records.some(record => record.ref === link.ref)); if (section) setExpanded(previous => new Set(previous).add(section.id)); setSelectedRef(link.ref) } }} disabled={!link.target}>
                    <span>↳</span><span className="mono">{link.ref}</span>
                    <small>{link.target ? 'VIEW' : 'UNAVAILABLE'}</small>
                  </button>
                ))}</div>
              ) : <p className="unavailable">No causal refs were declared for this record.</p>}
              <div className="inspector-label">RAW MATERIAL</div>
              <div className="raw-placeholder"><strong>Not available in D0</strong><span>Real evidence and material digests require an owner adapter. Nothing is inferred from these synthetic cards.</span></div>
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
