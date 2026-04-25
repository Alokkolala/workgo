# Platform Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the WorkGo platform (React SPA + admin panel) to match the semi-polished grayscale wireframes from the Claude Design handoff bundle.

**Architecture:** The wireframes introduce a design system (grayscale + warm beige AI accent, Inter + JetBrains Mono fonts) delivered via CSS custom properties. The React SPA pages switch from a blue Tailwind theme to the new design system with inline style tokens. The admin panel (`client/index.html`) moves from a dark 2-pane terminal to a light 3-pane WhatsApp ops console matching Admin_A.

**Tech Stack:** React + Vite, Tailwind CDN (kept for layout), CSS custom properties (design tokens), vanilla HTML/JS (admin panel)

---

## Design System Reference

The wireframes define these tokens — referenced throughout the plan:

```
--ink:         #0F0F10       /* primary text */
--ink-2:       #2A2A2D
--muted:       #6B6B70       /* secondary text */
--muted-2:     #9A9A9F
--line:        #D9D9DC       /* borders */
--line-soft:   #E9E9EB
--paper:       #FAFAF8       /* page background */
--paper-2:     #F2F2EF       /* slightly darker bg */
--card:        #FFFFFF
--accent:      oklch(0.78 0.04 75)   /* warm beige — AI/match elements ONLY */
--accent-ink:  oklch(0.42 0.05 60)   /* dark tan text on accent */
--accent-soft: oklch(0.94 0.02 80)   /* light cream AI background */
```

Fonts: Inter (UI text), JetBrains Mono (labels/stats/code), Caveat (hand-drawn annotations).

---

## File Map

**Modified:**
- `client/platform/index.html` — add Google Fonts + CSS custom property block
- `client/platform/src/components/JobCard.jsx` — wireframe card style with match bar
- `client/platform/src/components/FilterBar.jsx` — chip-based district + type filters
- `client/platform/src/pages/JobBoard.jsx` — Feed_C grid layout (title + AI strip + grid)
- `client/platform/src/pages/JobDetail.jsx` — Detail_B two-column layout
- `client/platform/src/pages/Profile.jsx` — Onboarding_B step-form style
- `client/index.html` — Admin_A 3-pane WhatsApp ops console (complete HTML rewrite, JS preserved)

---

## Task 1: Design tokens — fonts + CSS custom properties

**Files:**
- Modify: `client/platform/index.html`

- [ ] **Step 1: Replace index.html with version that includes fonts and design tokens**

Replace the entire content of `client/platform/index.html` with:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkGo — Работа в Актау</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --ink:         #0F0F10;
      --ink-2:       #2A2A2D;
      --muted:       #6B6B70;
      --muted-2:     #9A9A9F;
      --line:        #D9D9DC;
      --line-soft:   #E9E9EB;
      --paper:       #FAFAF8;
      --paper-2:     #F2F2EF;
      --card:        #FFFFFF;
      --accent:      oklch(0.78 0.04 75);
      --accent-ink:  oklch(0.42 0.05 60);
      --accent-soft: oklch(0.94 0.02 80);
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--paper-2);
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
    }
    .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

    /* Chip component */
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: 11px;
      color: var(--ink-2);
      background: var(--card);
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.1s, border-color 0.1s;
      font-family: 'Inter', sans-serif;
    }
    .chip:hover { border-color: var(--ink-2); }
    .chip.active { background: var(--ink); color: var(--card); border-color: var(--ink); }
    .chip.ai {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent-ink);
    }

    /* Match bar */
    .match-bar {
      height: 3px;
      background: var(--line-soft);
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }
    .match-bar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--accent);
      border-radius: 2px;
      transition: width 0.3s;
    }

    /* AI strip */
    .ai-strip {
      background: var(--accent-soft);
      border: 1px dashed var(--accent);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--accent-ink);
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ai-strip::before { content: "✦ AI"; font-weight: 600; }

    /* Section divider with label */
    .section-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .section-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: var(--line);
    }

    /* Eyebrow label */
    .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 2: Verify Vite still builds**

```bash
cd client/platform && npm run build
```

Expected: build completes, no errors.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add client/platform/index.html
git commit -m "feat(design): add design system tokens and fonts to React SPA"
```

---

## Task 2: Redesign JobCard component

**Files:**
- Modify: `client/platform/src/components/JobCard.jsx`

The wireframe JobCard shows: company + district (small mono), job title (bold), salary + type chips, match score "✦ N%" with a filled bar, and a match reason in AI styling.

- [ ] **Step 1: Replace JobCard.jsx entirely**

```jsx
import { Link } from 'react-router-dom'

const TYPE_LABEL = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }

export default function JobCard({ job, matchReason }) {
  const biz = job.businesses || {}
  const matchScore = job._matchScore  // set by MatchModal results

  return (
    <Link
      to={`/job/${job.id}`}
      style={{
        display: 'block',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: 14,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink-2)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Company + district */}
      <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
        {biz.name}{biz.address ? ` · ${extractDistrict(biz.address)}` : ''}
      </div>

      {/* Title */}
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, lineHeight: 1.3 }}>
        {job.title || 'Вакансия'}
      </div>

      {/* Salary + type chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: matchScore ? 10 : 0 }}>
        {job.salary && (
          <span className="chip" style={{ fontSize: 10, padding: '3px 8px', cursor: 'default' }}>
            {job.salary}
          </span>
        )}
        {job.employment_type && (
          <span className="chip" style={{ fontSize: 10, padding: '3px 8px', cursor: 'default' }}>
            {TYPE_LABEL[job.employment_type] || job.employment_type}
          </span>
        )}
      </div>

      {/* Match score + bar */}
      {matchScore && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--accent-ink)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
              ✦ {matchScore}% совпадение
            </span>
          </div>
          <div className="match-bar">
            <div className="match-bar-fill" style={{ width: `${matchScore}%` }} />
          </div>
        </div>
      )}

      {/* AI match reason */}
      {matchReason && (
        <div style={{
          marginTop: 8,
          padding: '6px 8px',
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent)',
          borderRadius: 5,
          fontSize: 11,
          color: 'var(--accent-ink)',
          lineHeight: 1.4,
          fontStyle: 'italic',
        }}>
          {matchReason}
        </div>
      )}
    </Link>
  )
}

// Extract district from address string (e.g. "5 микрорайон, ..." → "5 мкр")
function extractDistrict(address) {
  if (!address) return ''
  const m = address.match(/(\d+)[- ]?(?:мкр|микрорайон)/i)
  if (m) return `${m[1]} мкр`
  if (address.toLowerCase().includes('новый город')) return 'Новый город'
  return address.slice(0, 25)
}
```

- [ ] **Step 2: Build and check for errors**

```bash
cd client/platform && npm run build
```

Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add client/platform/src/components/JobCard.jsx
git commit -m "feat(design): redesign JobCard with match bar and design system tokens"
```

---

## Task 3: Redesign FilterBar component

**Files:**
- Modify: `client/platform/src/components/FilterBar.jsx`

The wireframe uses chip-based filters (district + employment type) instead of `<select>` dropdowns.

- [ ] **Step 1: Replace FilterBar.jsx entirely**

```jsx
const DISTRICTS = [
  { value: '1-й мкр', label: '1–6 мкр' },
  { value: '7-й мкр', label: '7–12 мкр' },
  { value: '14-й мкр', label: '14 мкр' },
  { value: '17-й мкр', label: '17 мкр' },
  { value: '27-й мкр', label: '27 мкр' },
  { value: 'Новый город', label: 'Новый город' },
]

const TYPES = [
  { value: 'gig', label: 'Подработка' },
  { value: 'part', label: 'Частичная' },
  { value: 'full', label: 'Полная' },
]

export default function FilterBar({ filters, onChange }) {
  const set = (key, value) => {
    // Toggle off if already selected
    onChange({ ...filters, [key]: filters[key] === value ? '' : value })
  }

  const hasActive = filters.employment_type || filters.district

  return (
    <div style={{
      background: 'var(--paper)',
      borderBottom: '1px solid var(--line)',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '10px 16px' }}>
        {/* District chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Район</span>
          {DISTRICTS.map(d => (
            <button
              key={d.value}
              className={`chip${filters.district === d.value ? ' active' : ''}`}
              onClick={() => set('district', d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Employment type chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Тип</span>
          {TYPES.map(t => (
            <button
              key={t.value}
              className={`chip${filters.employment_type === t.value ? ' active' : ''}`}
              onClick={() => set('employment_type', t.value)}
            >
              {t.label}
            </button>
          ))}
          {hasActive && (
            <button
              className="chip"
              onClick={() => onChange({ search: filters.search })}
              style={{ color: 'var(--muted)', borderStyle: 'dashed' }}
            >
              × Сбросить
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build and check**

```bash
cd client/platform && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd ../..
git add client/platform/src/components/FilterBar.jsx
git commit -m "feat(design): redesign FilterBar with chip-based district and type filters"
```

---

## Task 4: Redesign JobBoard page

**Files:**
- Modify: `client/platform/src/pages/JobBoard.jsx`

The wireframe Feed_C layout: clean header (no blue gradient), page title + search, chip filters, AI strip (when matched), grid of job cards.

- [ ] **Step 1: Replace JobBoard.jsx entirely**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getJobs } from '../api.js'
import JobCard from '../components/JobCard.jsx'
import FilterBar from '../components/FilterBar.jsx'
import MatchModal from '../components/MatchModal.jsx'

export default function JobBoard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [showMatch, setShowMatch] = useState(false)
  const [matchedJobs, setMatchedJobs] = useState(null)

  useEffect(() => { loadJobs() }, [filters])

  async function loadJobs() {
    setLoading(true)
    setMatchedJobs(null)
    const params = { ...filters }
    if (search.trim()) params.search = search.trim()
    const { jobs } = await getJobs(params)
    setJobs(jobs || [])
    setLoading(false)
  }

  function handleSearch(e) {
    if (e.key === 'Enter') loadJobs()
  }

  function handleMatches(matches) {
    setMatchedJobs(matches)
    // Attach match score to each job for JobCard to display
    setJobs(matches.map(m => ({ ...m.job, _matchScore: m.score, _matchReason: m.reason })))
  }

  const displayJobs = matchedJobs
    ? matchedJobs.map(m => ({ ...m.job, _matchScore: m.score, _matchReason: m.reason }))
    : jobs

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-2)' }}>
      {/* Topbar */}
      <header style={{
        background: 'var(--paper)',
        borderBottom: '1px solid var(--line)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 16px',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: 'var(--ink)',
            }} />
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>WorkGo</span>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: 14, fontSize: 12, marginLeft: 8 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Вакансии</span>
            <Link to="/profile" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Мой профиль</Link>
            <Link to="/employer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Работодателям</Link>
          </nav>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '0 10px',
            height: 32,
            background: 'var(--card)',
            width: 260,
          }}>
            <span style={{ color: 'var(--muted-2)', fontSize: 13 }}>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Должность, компания…"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 12,
                background: 'transparent',
                color: 'var(--ink)',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); loadJobs() }}
                style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
              >×</button>
            )}
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Main content */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        {/* Page title + AI match button */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
              Работа рядом с домом
            </h1>
            <p className="mono" style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>
              Реальные вакансии малого бизнеса Мангистауской области
            </p>
          </div>
          <button
            onClick={() => setShowMatch(true)}
            className="chip ai"
            style={{ fontSize: 11, padding: '6px 12px', fontWeight: 600 }}
          >
            ✦ AI подбор
          </button>
        </div>

        {/* AI strip when matched results shown */}
        {matchedJobs && (
          <div className="ai-strip" style={{ marginBottom: 16 }}>
            {`AI подобрал ${displayJobs.length} вакансий под твой профиль — `}
            <button
              onClick={loadJobs}
              style={{ color: 'var(--accent-ink)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 12, textDecoration: 'underline', padding: 0 }}
            >
              показать все →
            </button>
          </div>
        )}

        {/* Divider */}
        {matchedJobs && (
          <div className="section-divider" style={{ marginBottom: 14 }}>
            Топ совпадений
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mono" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 11 }}>
            Загружаем вакансии…
          </div>
        )}

        {/* Empty state */}
        {!loading && displayJobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>Вакансий не найдено</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted-2)' }}>Попробуйте изменить фильтры</div>
          </div>
        )}

        {/* Job grid — 3 columns */}
        {!loading && displayJobs.length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>
              {matchedJobs ? `${displayJobs.length} AI-подобранных` : `${displayJobs.length} вакансий`}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {displayJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  matchReason={job._matchReason}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {showMatch && <MatchModal onClose={() => setShowMatch(false)} onMatches={handleMatches} />}
    </div>
  )
}
```

- [ ] **Step 2: Build and verify**

```bash
cd client/platform && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add client/platform/src/pages/JobBoard.jsx
git commit -m "feat(design): redesign JobBoard with Feed_C grid layout and design system"
```

---

## Task 5: Redesign JobDetail page

**Files:**
- Modify: `client/platform/src/pages/JobDetail.jsx`

The wireframe Detail_B: two-column layout — job content on left, sticky sidebar on right with conditions card + AI match card.

- [ ] **Step 1: Replace JobDetail.jsx entirely**

```jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getJob } from '../api.js'
import ApplyModal from '../components/ApplyModal.jsx'

const TYPE_LABEL = { full: 'Полная занятость', part: 'Частичная', gig: 'Подработка' }

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)

  useEffect(() => {
    getJob(id).then(data => { setJob(data.error ? null : data); setLoading(false) })
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>Загрузка…</span>
    </div>
  )
  if (!job) return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <span style={{ color: 'var(--muted)' }}>Вакансия не найдена</span>
      <Link to="/" style={{ color: 'var(--ink)', fontSize: 12 }}>← Все вакансии</Link>
    </div>
  )

  const biz = job.businesses || {}
  // Check localStorage for saved match reason
  const savedMatches = JSON.parse(sessionStorage.getItem('wg_matches') || '[]')
  const myMatch = savedMatches.find(m => m.job_id === id)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-2)' }}>
      {/* Topbar */}
      <header style={{
        background: 'var(--paper)',
        borderBottom: '1px solid var(--line)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', padding: '0 16px',
          height: 44, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Link to="/" style={{ color: 'var(--muted)', fontSize: 11, textDecoration: 'none' }}>← Вакансии</Link>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--ink)' }} />
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.02em' }}>WorkGo</span>
          </div>
        </div>
      </header>

      {/* Two-column content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 16px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>

        {/* LEFT — job content */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {biz.name}{biz.address ? ` · ${biz.address}` : ''}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
            {job.title}
          </h1>

          {/* Chips row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {job.employment_type && <span className="chip" style={{ cursor: 'default' }}>{TYPE_LABEL[job.employment_type]}</span>}
            {job.salary && <span className="chip" style={{ cursor: 'default' }}>{job.salary}</span>}
          </div>

          {/* Description */}
          {(job.description || job.requirements) && (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 20,
            }}>
              {job.description && (
                <div style={{ marginBottom: job.requirements ? 20 : 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>О вакансии</div>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{job.description}</p>
                </div>
              )}
              {job.requirements && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Требования</div>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{job.requirements}</p>
                </div>
              )}
            </div>
          )}

          {!job.description && !job.requirements && (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 20,
              color: 'var(--muted)',
              fontSize: 13,
            }}>
              Подробное описание вакансии уточняется у работодателя.
            </div>
          )}
        </div>

        {/* RIGHT — sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Conditions card */}
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 16,
            position: 'sticky',
            top: 60,
          }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Условия</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, marginBottom: 16 }}>
              {job.salary && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>З/п</span>
                  <strong>{job.salary}</strong>
                </div>
              )}
              {job.employment_type && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Тип</span>
                  <span>{TYPE_LABEL[job.employment_type]}</span>
                </div>
              )}
              {biz.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Адрес</span>
                  <span style={{ textAlign: 'right', fontSize: 12 }}>{biz.address}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowApply(true)}
              style={{
                width: '100%',
                background: 'var(--ink)',
                color: 'var(--card)',
                border: 'none',
                borderRadius: 6,
                padding: '10px 0',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                marginBottom: 8,
              }}
            >
              Откликнуться
            </button>
          </div>

          {/* AI match card */}
          {myMatch && (
            <div style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              padding: 14,
            }}>
              <div className="eyebrow" style={{ color: 'var(--accent-ink)', marginBottom: 8 }}>
                ✦ AI · {myMatch.score}/10 совпадение
              </div>
              <p style={{ fontSize: 12, color: 'var(--accent-ink)', lineHeight: 1.5, margin: 0 }}>
                {myMatch.reason}
              </p>
            </div>
          )}
        </div>
      </div>

      {showApply && <ApplyModal jobId={id} onClose={() => setShowApply(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
cd client/platform && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd ../..
git add client/platform/src/pages/JobDetail.jsx
git commit -m "feat(design): redesign JobDetail with Detail_B two-column layout"
```

---

## Task 6: Redesign Profile page

**Files:**
- Modify: `client/platform/src/pages/Profile.jsx`

The wireframe Onboarding_B style: step progress indicator, chip-based field selectors (sphere, employment type, district), AI badge on experience field.

- [ ] **Step 1: Replace Profile.jsx entirely**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createOrUpdateApplicant, getApplicantById, getApplicationsByApplicant, matchJobs } from '../api.js'

const SPHERES = ['Общепит', 'Ритейл', 'Логистика', 'IT', 'Стройка', 'Сервис', 'Банки', 'Медицина']
const TYPES = [
  { value: 'full', label: 'Полная' },
  { value: 'part', label: 'Частичная' },
  { value: 'gig', label: 'Подработка' },
]
const EXPERIENCES = [
  { value: '0-1 лет', label: 'До 1 года' },
  { value: '1-3 лет', label: '1–3 года' },
  { value: '3+ лет', label: '3+ лет' },
]
const DISTRICTS = ['1–6 мкр', '7–12 мкр', '14 мкр', '17 мкр', '27 мкр', 'Новый город']
const DISTRICT_VALUES = ['1-й мкр', '7-й мкр', '14-й мкр', '17-й мкр', '27-й мкр', 'Новый город']

const STATUS_LABEL = { pending: 'Ожидает', viewed: 'Просмотрено', accepted: 'Принят', rejected: 'Отказ' }
const STATUS_COLOR = { pending: 'var(--muted)', viewed: 'var(--ink)', accepted: '#2E5C2E', rejected: 'var(--muted-2)' }

export default function Profile() {
  const [form, setForm] = useState({
    name: '', phone: '', skills: '', experience: '',
    employment_type: '', district: '', bio: ''
  })
  const [applications, setApplications] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [saving, setSaving] = useState(false)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('wg_applicant') || '{}')
    if (saved.id) {
      getApplicantById(saved.id).then(p => {
        if (!p.error) setForm({
          name: p.name || '', phone: p.phone || '',
          skills: p.skills || '', experience: p.experience || '',
          employment_type: p.employment_type || '', district: p.district || '',
          bio: p.bio || ''
        })
      })
      getApplicationsByApplicant(saved.id).then(setApplications)
    }
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) {
      setMsg({ text: 'Введите имя и телефон', type: 'error' })
      return
    }
    setSaving(true)
    const applicant = await createOrUpdateApplicant(form)
    setSaving(false)
    if (applicant.error) { setMsg({ text: applicant.error, type: 'error' }); return }
    localStorage.setItem('wg_applicant', JSON.stringify({ id: applicant.id, name: applicant.name, phone: applicant.phone }))
    setMsg({ text: 'Профиль сохранён', type: 'success' })
    getApplicationsByApplicant(applicant.id).then(setApplications)
  }

  async function findMatches() {
    if (!form.skills.trim()) { alert('Укажите навыки для AI-подбора'); return }
    setMatching(true)
    const { matches } = await matchJobs({ skills: form.skills, experience: form.experience, employment_type: form.employment_type, district: form.district })
    setMatching(false)
    if (!matches?.length) { alert('Подходящих вакансий не найдено'); return }
    sessionStorage.setItem('wg_matches', JSON.stringify(matches))
    window.location.href = '/platform/'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-2)' }}>
      {/* Topbar */}
      <header style={{
        background: 'var(--paper)',
        borderBottom: '1px solid var(--line)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          maxWidth: 640, margin: '0 auto', padding: '0 16px',
          height: 44, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Link to="/" style={{ color: 'var(--muted)', fontSize: 11, textDecoration: 'none' }}>← Вакансии</Link>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--ink)' }} />
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.02em' }}>WorkGo</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20 }}>Мой профиль</h1>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          {/* Name + phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field label="Имя *">
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Айдар"
                style={inputStyle} />
            </Field>
            <Field label="Телефон *">
              <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" placeholder="87001234567"
                style={inputStyle} />
            </Field>
          </div>

          {/* Skills */}
          <Field label="Навыки" style={{ marginBottom: 16 }}>
            <input value={form.skills} onChange={e => set('skills', e.target.value)}
              placeholder="повар, кассир, 1С, английский…"
              style={inputStyle} />
          </Field>

          {/* Experience chips */}
          <Field label="Опыт" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EXPERIENCES.map(e => (
                <button key={e.value}
                  className={`chip${form.experience === e.value ? ' active' : ''}`}
                  onClick={() => set('experience', form.experience === e.value ? '' : e.value)}>
                  {e.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Employment type chips */}
          <Field label="Тип занятости" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TYPES.map(t => (
                <button key={t.value}
                  className={`chip${form.employment_type === t.value ? ' active' : ''}`}
                  onClick={() => set('employment_type', form.employment_type === t.value ? '' : t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          {/* District chips */}
          <Field label="Район Актау" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DISTRICTS.map((d, i) => (
                <button key={d}
                  className={`chip${form.district === DISTRICT_VALUES[i] ? ' active' : ''}`}
                  onClick={() => set('district', form.district === DISTRICT_VALUES[i] ? '' : DISTRICT_VALUES[i])}>
                  {d}
                </button>
              ))}
            </div>
          </Field>

          {/* Bio with AI badge */}
          <Field label="О себе">
            <div style={{ position: 'relative' }}>
              <span className="chip ai" style={{
                position: 'absolute', top: 8, right: 8, fontSize: 9, padding: '2px 7px', cursor: 'default',
              }}>
                ✦ AI поможет описать
              </span>
              <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
                rows={3} placeholder="Расскажи о себе свободно…"
                style={{ ...inputStyle, resize: 'none', paddingTop: 10, paddingRight: 120 }} />
            </div>
          </Field>

          {msg.text && (
            <div style={{
              marginTop: 12,
              fontSize: 12,
              color: msg.type === 'error' ? '#c0392b' : '#2E5C2E',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {msg.type === 'success' ? '✓ ' : '✗ '}{msg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={save} disabled={saving} style={{
              flex: 1,
              background: 'var(--ink)', color: 'var(--card)',
              border: 'none', borderRadius: 6, padding: '10px 0',
              fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
            }}>
              {saving ? 'Сохраняем…' : 'Сохранить профиль'}
            </button>
            <button onClick={findMatches} disabled={matching} className="chip ai" style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              opacity: matching ? 0.5 : 1, cursor: matching ? 'not-allowed' : 'pointer',
            }}>
              {matching ? 'AI анализирует…' : '✦ Найти вакансии'}
            </button>
          </div>
        </div>

        {/* Applications */}
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Мои отклики</h2>
        {applications.length === 0 ? (
          <div style={{
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8,
            padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center',
          }}>
            Откликов нет. <Link to="/" style={{ color: 'var(--ink)' }}>Найти вакансии →</Link>
          </div>
        ) : applications.map(app => {
          const job = app.jobs || {}
          const biz = job.businesses || {}
          return (
            <div key={app.id} style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{job.title || 'Вакансия'}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {biz.name}{job.salary ? ` · ${job.salary}` : ''}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 10, color: STATUS_COLOR[app.status] || 'var(--muted)' }}>
                {STATUS_LABEL[app.status] || app.status}
              </span>
            </div>
          )
        })}
      </main>
    </div>
  )
}

// Simple field wrapper
function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  height: 36,
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: '0 10px',
  fontSize: 12,
  color: 'var(--ink)',
  background: 'var(--card)',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
}
```

- [ ] **Step 2: Build**

```bash
cd client/platform && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd ../..
git add client/platform/src/pages/Profile.jsx client/platform/dist/
git commit -m "feat(design): redesign Profile with chip-based form and design system"
```

---

## Task 7: Redesign Admin panel — 3-pane WhatsApp ops console

**Files:**
- Modify: `client/index.html`

This is the most complex task. The existing dark 2-pane layout becomes the light Admin_A 3-pane layout. All JavaScript logic (SSE, Supabase Realtime, business list, stats) is preserved — only the HTML structure and CSS change. New JS is added to render WhatsApp-style chat bubbles and extracted job fields.

The 3 panes:
- **Left (300px):** Business list with status dots, search, filter chips, unread badges
- **Center (flex):** WhatsApp conversation — green agent bubbles (right), white company bubbles (left), WA dotted background, draft approval area at bottom
- **Right (280px):** Extracted job fields card + daily stats + DB action log

- [ ] **Step 1: Read the current client/index.html to identify all JS logic to preserve**

Read `client/index.html` — identify all `<script>` blocks, SSE connection, Supabase Realtime subscription, business selection, stats loading, scraper/contact-all buttons.

- [ ] **Step 2: Replace client/index.html with the new 3-pane design**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkGo — Control Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <style>
    :root {
      --ink: #0F0F10; --ink-2: #2A2A2D;
      --muted: #6B6B70; --muted-2: #9A9A9F;
      --line: #D9D9DC; --line-soft: #E9E9EB;
      --paper: #FAFAF8; --paper-2: #F2F2EF; --card: #FFFFFF;
      --accent: oklch(0.78 0.04 75);
      --accent-ink: oklch(0.42 0.05 60);
      --accent-soft: oklch(0.94 0.02 80);
      --wa-bg: #ECE5DD;
      --wa-agent: #DCF8C6;
      --wa-header: #F0F2F5;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--paper-2);
      color: var(--ink);
      -webkit-font-smoothing: antialiased;
      font-size: 13px;
    }
    .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted);
    }

    /* Layout */
    #app { display: flex; flex-direction: column; height: 100vh; }
    #topbar {
      height: 44px; border-bottom: 1px solid var(--line);
      display: flex; align-items: center; padding: 0 16px; gap: 16px;
      background: var(--paper); flex-shrink: 0;
    }
    #logo { display: flex; align-items: center; gap: 8px; }
    #logo-sq { width: 16px; height: 16px; border-radius: 4px; background: var(--ink); }
    #logo-text { font-weight: 700; font-size: 14px; letter-spacing: -0.02em; }
    #topbar-meta { font-size: 11px; color: var(--muted); }
    #wa-status { margin-left: auto; }
    #wa-badge {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      padding: 3px 8px; border-radius: 4px;
      border: 1px solid var(--line); color: var(--muted); background: var(--paper-2);
    }
    #wa-badge.online { border-color: #C8DCC8; color: #2E5C2E; background: #EAF3EA; }

    /* Stats strip */
    #stats-bar {
      display: grid; grid-template-columns: repeat(6, 1fr);
      border-bottom: 1px solid var(--line);
      background: var(--paper); flex-shrink: 0;
    }
    .stat-cell {
      padding: 8px 10px; text-align: center; border-right: 1px solid var(--line-soft);
    }
    .stat-cell:last-child { border-right: none; }
    .stat-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-num { font-weight: 600; font-size: 18px; letter-spacing: -0.02em; line-height: 1.2; margin-top: 1px; color: var(--ink); }

    /* 3-pane body */
    #body { display: flex; flex: 1; overflow: hidden; }

    /* LEFT PANE */
    #left-pane {
      width: 300px; flex-shrink: 0;
      border-right: 1px solid var(--line);
      display: flex; flex-direction: column;
      background: var(--paper);
    }
    #left-header {
      padding: 12px 14px; border-bottom: 1px solid var(--line); flex-shrink: 0;
    }
    #left-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    #agent-badge {
      font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 2px 7px;
      border-radius: 3px; border: 1px solid #C8DCC8; background: #EAF3EA; color: #2E5C2E;
    }
    #biz-search {
      width: 100%; height: 28px; border: 1px solid var(--line); border-radius: 5px;
      padding: 0 10px; font-size: 11px; color: var(--ink); background: var(--card);
      outline: none; font-family: 'Inter', sans-serif; margin-bottom: 8px;
    }
    #biz-search:focus { border-color: var(--ink-2); }
    #left-chips { display: flex; gap: 5px; flex-wrap: wrap; }
    .l-chip {
      display: inline-flex; align-items: center; padding: 3px 8px;
      border: 1px solid var(--line); border-radius: 999px; font-size: 9px;
      color: var(--ink-2); background: var(--card); cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .l-chip.on { background: var(--ink); color: var(--card); border-color: var(--ink); }
    .l-chip.ai { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-ink); }

    #biz-list { flex: 1; overflow-y: auto; }
    .biz-row {
      display: grid; grid-template-columns: 36px 1fr auto;
      gap: 10px; padding: 10px 14px;
      border-left: 3px solid transparent;
      border-bottom: 1px solid var(--line-soft);
      cursor: pointer; align-items: center;
    }
    .biz-row:hover { background: var(--paper-2); }
    .biz-row.selected { background: var(--paper-2); border-left-color: var(--ink); }
    .biz-avatar {
      width: 34px; height: 34px; border-radius: 50%; background: var(--line);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; color: var(--muted); flex-shrink: 0;
    }
    .biz-info { min-width: 0; }
    .biz-name-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
    .biz-name { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .biz-time { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--muted); white-space: nowrap; flex-shrink: 0; margin-left: 6px; }
    .biz-last { display: flex; align-items: center; gap: 5px; }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .biz-last-text { font-size: 10px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unread-badge {
      background: #25D366; color: #fff; font-size: 9px; font-weight: 600;
      font-family: 'JetBrains Mono', monospace; padding: 2px 6px; border-radius: 999px;
    }

    #left-actions { padding: 10px 12px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    .action-btn {
      width: 100%; padding: 6px 10px; border: 1px solid var(--line); border-radius: 5px;
      background: var(--card); color: var(--ink-2); font-size: 11px; cursor: pointer;
      font-family: 'Inter', sans-serif; text-align: left;
    }
    .action-btn:hover { background: var(--paper-2); border-color: var(--ink-2); }

    /* CENTER PANE */
    #center-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    #wa-chat-header {
      padding: 10px 16px; border-bottom: 1px solid var(--line);
      background: var(--wa-header);
      display: flex; align-items: center; gap: 12; flex-shrink: 0;
    }
    #wa-chat-header { gap: 12px; }
    #wa-header-avatar {
      width: 36px; height: 36px; border-radius: 50%; background: var(--line);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600; color: var(--muted); flex-shrink: 0;
    }
    #wa-header-info { flex: 1; }
    #wa-header-name { font-weight: 600; font-size: 13px; }
    #wa-header-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); margin-top: 1px; }
    .ai-badge {
      font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 3px 8px;
      border-radius: 4px; background: var(--accent-soft); border: 1px solid var(--accent);
      color: var(--accent-ink);
    }
    #takeover-btn {
      padding: 5px 10px; border: 1px solid var(--line); border-radius: 5px;
      background: var(--card); font-size: 11px; cursor: pointer; color: var(--ink);
      font-family: 'Inter', sans-serif;
    }

    #messages-area {
      flex: 1; overflow-y: auto; padding: 12px 16px;
      background-image: radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 0);
      background-size: 16px 16px;
      background-color: var(--wa-bg);
      display: flex; flex-direction: column; gap: 6px;
    }
    .wa-msg {
      max-width: 76%; padding: 8px 10px 6px;
      border-radius: 8px; font-size: 12px; line-height: 1.45;
      border: 1px solid #E1E1E1; box-shadow: 0 1px 0 rgba(0,0,0,0.04);
      position: relative;
    }
    .wa-msg.agent { align-self: flex-end; background: var(--wa-agent); }
    .wa-msg.company { align-self: flex-start; background: #FFFFFF; }
    .wa-msg-time {
      font-family: 'JetBrains Mono', monospace; font-size: 9px;
      color: #7C7C7C; text-align: right; margin-top: 4px;
    }
    .wa-tick { margin-left: 4px; color: #4FC3F7; }
    .wa-day-break { display: flex; justify-content: center; margin: 6px 0; }
    .wa-day-label {
      background: rgba(225,245,254,0.92); color: #5C6770; font-size: 10px;
      padding: 3px 10px; border-radius: 6px; font-family: 'JetBrains Mono', monospace;
    }
    .wa-typing {
      align-self: center; font-family: 'JetBrains Mono', monospace; font-size: 9px;
      color: var(--muted); background: rgba(255,255,255,0.6);
      padding: 4px 8px; border-radius: 4px;
    }
    #center-empty {
      flex: 1; display: flex; align-items: center; justify-content: center;
      background: var(--wa-bg); flex-direction: column; gap: 8px;
    }
    #center-empty-text { font-size: 13px; color: var(--muted); }
    #center-empty-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted-2); }

    #wa-input-area {
      padding: 10px 12px; border-top: 1px solid var(--line);
      background: var(--wa-header); flex-shrink: 0;
    }
    #draft-card {
      background: #FFFCF0; border: 1px solid var(--accent); border-radius: 6px;
      padding: 10px 12px;
    }
    #draft-header {
      font-family: 'JetBrains Mono', monospace; font-size: 9px;
      color: var(--accent-ink); text-transform: uppercase; letter-spacing: 0.1em;
      margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
    }
    #draft-text { font-size: 12px; line-height: 1.45; color: var(--ink-2); margin-bottom: 8px; }
    #draft-actions { display: flex; gap: 6px; }
    .draft-btn {
      padding: 4px 10px; border-radius: 4px; font-size: 10px; cursor: pointer;
      font-family: 'Inter', sans-serif; border: 1px solid var(--line);
      background: var(--card); color: var(--ink);
    }
    .draft-btn.primary { background: var(--ink); color: var(--card); border-color: var(--ink); }

    /* RIGHT PANE */
    #right-pane {
      width: 280px; flex-shrink: 0;
      border-left: 1px solid var(--line);
      background: var(--paper);
      display: flex; flex-direction: column;
      overflow-y: auto;
    }
    .r-section { padding: 14px 16px; border-bottom: 1px solid var(--line); }
    .r-section:last-child { border-bottom: none; }
    .r-title { font-weight: 600; font-size: 12px; margin-bottom: 10px; }

    #fields-card {
      background: var(--accent-soft); border: 1px solid var(--accent);
      border-radius: 6px; padding: 12px; margin-bottom: 10px;
    }
    .field-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 7px; }
    .field-row:last-child { margin-bottom: 0; }
    .field-key { color: var(--muted); }
    .field-val { font-weight: 600; color: var(--ink); text-align: right; }
    #fields-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 8px; border-top: 1px dashed var(--accent); margin-top: 6px;
    }
    #vacancy-id { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--accent-ink); }
    #saved-badge {
      font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 2px 6px;
      border-radius: 3px; background: #EAF3EA; border: 1px solid #C8DCC8; color: #2E5C2E;
    }
    #no-fields {
      color: var(--muted-2); font-size: 11px; padding: 10px 0;
      font-family: 'JetBrains Mono', monospace;
    }
    #field-actions { display: flex; gap: 6px; }
    .r-action-btn {
      flex: 1; padding: 5px 0; border: 1px solid var(--line); border-radius: 4px;
      background: var(--card); font-size: 10px; cursor: pointer; text-align: center;
      font-family: 'Inter', sans-serif; color: var(--ink-2);
    }
    .r-action-btn:hover { background: var(--paper-2); }

    .stats-grid { display: flex; flex-direction: column; gap: 10px; }
    .stat-item .num { font-weight: 600; font-size: 20px; letter-spacing: -0.02em; }
    .stat-item .lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

    #log-list { display: flex; flex-direction: column; gap: 4px; }
    .log-entry { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); }
    .log-entry.highlight { color: var(--accent-ink); }
    .log-entry.send { color: var(--ink-2); }
    .log-entry.db { color: #2E5C2E; }
    .log-entry.error { color: #c0392b; }
  </style>
</head>
<body>
<div id="app">

  <!-- TOPBAR -->
  <div id="topbar">
    <div id="logo">
      <div id="logo-sq"></div>
      <span id="logo-text">WorkGo</span>
    </div>
    <span id="topbar-meta" class="mono">Control Center · AI-агент</span>
    <div id="wa-status" style="display:flex;align-items:center;gap:8px;">
      <span id="wa-badge">WA: checking…</span>
      <span id="rt-badge" class="mono" style="font-size:10px;color:var(--muted)">⬤ connecting…</span>
    </div>
  </div>

  <!-- STATS BAR -->
  <div id="stats-bar">
    <div class="stat-cell"><div class="stat-label">Всего</div><div class="stat-num" id="s-total">—</div></div>
    <div class="stat-cell"><div class="stat-label">Найдено</div><div class="stat-num" id="s-disc" style="color:#6B6B70">—</div></div>
    <div class="stat-cell"><div class="stat-label">Связались</div><div class="stat-num" id="s-cont" style="color:#a5896a">—</div></div>
    <div class="stat-cell"><div class="stat-label">Интерес</div><div class="stat-num" id="s-int" style="color:var(--ink-2)">—</div></div>
    <div class="stat-cell"><div class="stat-label">Собираем</div><div class="stat-num" id="s-coll" style="color:var(--accent-ink)">—</div></div>
    <div class="stat-cell"><div class="stat-label">Готово</div><div class="stat-num" id="s-done" style="color:#2E5C2E">—</div></div>
  </div>

  <!-- 3-PANE BODY -->
  <div id="body">

    <!-- LEFT PANE: Business list -->
    <div id="left-pane">
      <div id="left-header">
        <div id="left-header-row">
          <span class="eyebrow">Компании · WhatsApp</span>
          <span id="agent-badge">● agent online</span>
        </div>
        <input id="biz-search" placeholder="⌕ Поиск по компании…" />
        <div id="left-chips">
          <button class="l-chip on" data-filter="all">все</button>
          <button class="l-chip" data-filter="active">активные</button>
          <button class="l-chip ai" data-filter="done">сохранено</button>
        </div>
      </div>
      <div id="biz-list"></div>
      <div id="left-actions">
        <button id="scrape-btn" class="action-btn">🔍 Запустить сбор компаний</button>
        <button id="contact-all-btn" class="action-btn">📢 Написать всем найденным</button>
      </div>
    </div>

    <!-- CENTER PANE: Chat -->
    <div id="center-pane">
      <!-- Chat header (hidden until business selected) -->
      <div id="wa-chat-header" style="display:none;">
        <div id="wa-header-avatar">CH</div>
        <div id="wa-header-info">
          <div id="wa-header-name">Coffee Hub</div>
          <div id="wa-header-sub">+7 700 000 00 00 · загрузка…</div>
        </div>
        <span class="ai-badge">✦ AI ведёт диалог</span>
        <button id="takeover-btn">Перехватить</button>
      </div>

      <!-- Empty state -->
      <div id="center-empty">
        <div id="center-empty-text">← Выберите компанию</div>
        <div id="center-empty-sub">чтобы увидеть переписку агента</div>
      </div>

      <!-- Messages (hidden until business selected) -->
      <div id="messages-area" style="display:none;"></div>

      <!-- WA input / draft area (hidden until business selected) -->
      <div id="wa-input-area" style="display:none;">
        <div id="draft-card">
          <div id="draft-header">✦ Черновик AI · ждёт одобрения</div>
          <div id="draft-text">—</div>
          <div id="draft-actions">
            <button class="draft-btn primary">✓ Отправить</button>
            <button class="draft-btn">Редактировать</button>
            <button class="draft-btn">Не отправлять</button>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT PANE: Extracted fields + stats + log -->
    <div id="right-pane">
      <!-- Extracted fields -->
      <div class="r-section">
        <div class="eyebrow" style="margin-bottom:10px;">Извлечено агентом · → БД</div>
        <div id="fields-area">
          <div id="no-fields">Выберите компанию</div>
        </div>
      </div>

      <!-- Daily stats -->
      <div class="r-section">
        <div class="eyebrow" style="margin-bottom:10px;">За сегодня</div>
        <div class="stats-grid">
          <div class="stat-item"><div class="num" id="stat-dialogs">—</div><div class="lbl">Диалогов</div></div>
          <div class="stat-item"><div class="num" id="stat-vacancies">—</div><div class="lbl">Вакансий извлечено</div></div>
          <div class="stat-item"><div class="num" id="stat-messages">—</div><div class="lbl">Сообщений отправлено</div></div>
        </div>
      </div>

      <!-- Action log -->
      <div class="r-section">
        <div class="eyebrow" style="margin-bottom:8px;">Последние действия</div>
        <div id="log-list"></div>
      </div>
    </div>

  </div><!-- end #body -->
</div><!-- end #app -->

<script>
// ── Config ────────────────────────────────────────────────────────
const API = '';
const SB_URL  = document.cookie.match(/sb_url=([^;]+)/)?.[1] || '';
const SB_KEY  = document.cookie.match(/sb_key=([^;]+)/)?.[1] || '';

// ── State ─────────────────────────────────────────────────────────
let allBusinesses = [];
let selectedId = null;
let logEntries = [];
let statsCache = {};
let filterMode = 'all';

// Status dot colors
const STATUS_DOT = {
  DISCOVERED:  '#9A9A9F',
  CONTACTED:   '#a5896a',
  INTERESTED:  '#2A2A2D',
  COLLECTING:  '#c9a97a',
  COMPLETED:   '#2E5C2E',
  REJECTED:    '#c0392b',
};
const STATUS_LABEL = {
  DISCOVERED: 'ждёт контакта',
  CONTACTED:  'написали',
  INTERESTED: 'заинтересован',
  COLLECTING: 'собираем данные',
  COMPLETED:  'вакансия в БД',
  REJECTED:   'отказ',
};

// ── Init Supabase ─────────────────────────────────────────────────
let sbClient = null;
try {
  const sbUrl  = (typeof SUPABASE_URL  !== 'undefined') ? SUPABASE_URL  : '';
  const sbKey  = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : '';
  if (sbUrl && sbKey) sbClient = supabase.createClient(sbUrl, sbKey);
} catch(e) {}

// ── SSE log stream ─────────────────────────────────────────────────
const LOG_MAX = 60;
function initSSE() {
  const es = new EventSource('/api/logs');
  es.onmessage = e => {
    try {
      const d = JSON.parse(e.data);
      appendLog(d);
      if (d.businessId && d.businessId === selectedId) {
        if (d.type === 'db') loadMessages(selectedId);
        if (d.type === 'state') loadBusinesses();
      }
      if (d.type === 'scraper' || d.type === 'state') loadStats();
    } catch {}
  };
  es.onerror = () => {
    setRtBadge('disconnected');
    setTimeout(initSSE, 3000);
  };
  es.onopen = () => setRtBadge('connected');
}

function appendLog(d) {
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = { time, msg: d.msg || '', type: d.type || '' };
  logEntries.unshift(entry);
  if (logEntries.length > LOG_MAX) logEntries.pop();
  renderLog();
}

function renderLog() {
  const el = document.getElementById('log-list');
  el.innerHTML = logEntries.slice(0, 20).map(e => {
    let cls = 'log-entry';
    if (e.type === 'db' || e.type === 'success') cls += ' db';
    else if (e.type === 'wa_out') cls += ' send';
    else if (e.type === 'gemini_res' || e.type === 'gemini_req') cls += ' highlight';
    else if (e.type === 'error') cls += ' error';
    return `<div class="${cls}">${e.time} ${e.msg.slice(0, 60)}</div>`;
  }).join('');
}

// ── Business list ─────────────────────────────────────────────────
async function loadBusinesses() {
  const res = await fetch('/api/businesses');
  if (!res.ok) return;
  const data = await res.json();
  allBusinesses = (data.data || data || []).sort((a, b) => {
    const order = ['COLLECTING','INTERESTED','CONTACTED','DISCOVERED','COMPLETED','REJECTED'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });
  renderBusinessList();
  loadStats();
}

function getFilteredBusinesses() {
  const q = document.getElementById('biz-search').value.toLowerCase();
  let list = allBusinesses;
  if (filterMode === 'active') list = list.filter(b => ['COLLECTING','INTERESTED','CONTACTED'].includes(b.status));
  if (filterMode === 'done') list = list.filter(b => b.status === 'COMPLETED');
  if (q) list = list.filter(b => (b.name + (b.category||'')).toLowerCase().includes(q));
  return list;
}

function renderBusinessList() {
  const list = getFilteredBusinesses();
  const el = document.getElementById('biz-list');
  if (!list.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;font-size:11px;color:var(--muted-2);font-family:JetBrains Mono,monospace;">Компаний нет — запустите сбор</div>';
    return;
  }
  el.innerHTML = list.map(b => {
    const initials = b.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const dotColor = STATUS_DOT[b.status] || '#9A9A9F';
    const label = STATUS_LABEL[b.status] || b.status;
    const sel = b.id === selectedId ? ' selected' : '';
    return `<div class="biz-row${sel}" onclick="selectBusiness('${b.id}')" data-id="${b.id}">
      <div class="biz-avatar">${initials}</div>
      <div class="biz-info">
        <div class="biz-name-row">
          <span class="biz-name">${escHtml(b.name)}</span>
          <span class="biz-time">${formatRelTime(b.updated_at)}</span>
        </div>
        <div class="biz-last">
          <span class="status-dot" style="background:${dotColor}"></span>
          <span class="biz-last-text">${escHtml(label)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Select business ───────────────────────────────────────────────
async function selectBusiness(id) {
  selectedId = id;
  renderBusinessList();

  const biz = allBusinesses.find(b => b.id === id);
  if (!biz) return;

  // Show chat header
  const initials = biz.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('wa-header-avatar').textContent = initials;
  document.getElementById('wa-header-name').textContent = biz.name;
  document.getElementById('wa-header-sub').textContent = (biz.phone || '—') + ' · ' + (STATUS_LABEL[biz.status] || biz.status);

  document.getElementById('wa-chat-header').style.display = 'flex';
  document.getElementById('center-empty').style.display = 'none';
  document.getElementById('messages-area').style.display = 'flex';
  document.getElementById('wa-input-area').style.display = 'block';

  loadMessages(id);
  loadExtractedFields(id);
}

// ── Messages (WhatsApp chat) ──────────────────────────────────────
async function loadMessages(bizId) {
  const res = await fetch(`/api/businesses/${bizId}/messages`);
  if (!res.ok) return;
  const msgs = await res.json();
  renderMessages(msgs);
}

function renderMessages(msgs) {
  const el = document.getElementById('messages-area');
  if (!msgs || !msgs.length) {
    el.innerHTML = '<div class="wa-day-break"><span class="wa-day-label">нет сообщений</span></div>';
    return;
  }

  // Group by date
  let lastDate = null;
  const html = msgs.map(m => {
    const date = new Date(m.created_at);
    const dateStr = date.toLocaleDateString('ru-RU');
    let dayBreak = '';
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      const isToday = dateStr === new Date().toLocaleDateString('ru-RU');
      dayBreak = `<div class="wa-day-break"><span class="wa-day-label">${isToday ? 'сегодня' : dateStr}</span></div>`;
    }
    const isAgent = m.role === 'agent';
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const text = escHtml(m.content).replace(/\n/g, '<br>');
    const tick = isAgent ? `<span class="wa-tick">✓✓</span>` : '';
    return `${dayBreak}<div class="wa-msg ${isAgent ? 'agent' : 'company'}">
      <div>${text}</div>
      <div class="wa-msg-time">${time}${tick}</div>
    </div>`;
  }).join('');

  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

// ── Extracted fields (right pane) ─────────────────────────────────
async function loadExtractedFields(bizId) {
  const res = await fetch(`/api/businesses/${bizId}/jobs`);
  if (!res.ok) return;
  const jobs = await res.json();
  renderExtractedFields(jobs[0] || null);
}

function renderExtractedFields(job) {
  const el = document.getElementById('fields-area');
  if (!job) {
    el.innerHTML = '<div id="no-fields" class="mono" style="color:var(--muted-2);font-size:11px;padding:8px 0;">Данные не извлечены</div>';
    return;
  }
  const fields = [
    ['Должность', job.title],
    ['Тип', job.employment_type],
    ['З/п', job.salary],
    ['Требования', job.requirements ? job.requirements.slice(0,40) + (job.requirements.length>40?'…':'') : null],
    ['Район', job.location],
  ].filter(([, v]) => v);

  el.innerHTML = `
    <div id="fields-card">
      ${fields.map(([k, v]) => `
        <div class="field-row">
          <span class="field-key">${escHtml(k)}</span>
          <span class="field-val">${escHtml(v)}</span>
        </div>`).join('')}
      <div id="fields-footer">
        <span id="vacancy-id" class="mono">id: ${job.id.slice(0,8)}…</span>
        <span id="saved-badge">сохранено</span>
      </div>
    </div>
    <div id="field-actions">
      <button class="r-action-btn" onclick="window.open('/platform/job/${job.id}','_blank')">Открыть →</button>
    </div>`;
}

// ── Stats ─────────────────────────────────────────────────────────
async function loadStats() {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) return;
  const d = await res.json();
  const total = Object.values(d).reduce((a,b) => a + (b||0), 0);
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-disc').textContent  = d.discovered || 0;
  document.getElementById('s-cont').textContent  = d.contacted  || 0;
  document.getElementById('s-int').textContent   = d.interested || 0;
  document.getElementById('s-coll').textContent  = d.collecting || 0;
  document.getElementById('s-done').textContent  = d.completed  || 0;

  // Daily stats (rough estimates from totals)
  document.getElementById('stat-dialogs').textContent   = (d.contacted || 0) + (d.interested || 0) + (d.collecting || 0);
  document.getElementById('stat-vacancies').textContent = d.completed || 0;
  document.getElementById('stat-messages').textContent  = '—';
}

// ── WA badge ─────────────────────────────────────────────────────
async function checkWA() {
  const res = await fetch('/health').catch(()=>null);
  const badge = document.getElementById('wa-badge');
  if (!res || !res.ok) { badge.textContent = 'WA: error'; return; }
  const d = await res.json();
  badge.textContent = d.whatsapp ? 'WA: online' : 'WA: offline';
  if (d.whatsapp) badge.classList.add('online'); else badge.classList.remove('online');
}

// ── RT badge ─────────────────────────────────────────────────────
function setRtBadge(state) {
  const el = document.getElementById('rt-badge');
  if (state === 'connected')    { el.textContent = '⬤ live'; el.style.color = '#2E5C2E'; }
  else if (state === 'disconnected') { el.textContent = '⬤ disconnected'; el.style.color = '#c0392b'; }
  else { el.textContent = '⬤ connecting…'; el.style.color = 'var(--muted)'; }
}

// ── Scraper / contact buttons ─────────────────────────────────────
document.getElementById('scrape-btn').onclick = async () => {
  const btn = document.getElementById('scrape-btn');
  btn.textContent = '⏳ Запускаем…'; btn.disabled = true;
  await fetch('/api/scrape', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ query: 'кафе Актау', maxPages: 3 }) });
  setTimeout(() => { btn.textContent = '🔍 Запустить сбор компаний'; btn.disabled = false; }, 3000);
};

document.getElementById('contact-all-btn').onclick = async () => {
  await fetch('/api/contact-all', { method: 'POST' });
};

// ── Filter chips ──────────────────────────────────────────────────
document.querySelectorAll('#left-chips .l-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    filterMode = btn.dataset.filter;
    document.querySelectorAll('#left-chips .l-chip').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    renderBusinessList();
  });
});

// ── Search ────────────────────────────────────────────────────────
document.getElementById('biz-search').addEventListener('input', renderBusinessList);

// ── Supabase Realtime ─────────────────────────────────────────────
function initRealtime() {
  if (!sbClient) { setRtBadge('disconnected'); return; }
  sbClient.channel('businesses').on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => {
    loadBusinesses();
  }).subscribe(status => {
    if (status === 'SUBSCRIBED') setRtBadge('connected');
    else setRtBadge('disconnected');
  });
}

// ── Helpers ───────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatRelTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'сейчас';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h/24)} д`;
}

// ── Boot ──────────────────────────────────────────────────────────
checkWA();
loadBusinesses();
initSSE();
initRealtime();
setInterval(checkWA, 15000);
setInterval(loadStats, 30000);
</script>
</body>
</html>
```

- [ ] **Step 3: Verify the file renders without errors**

Start the server (`node server/index.js`) and open http://localhost:4242 in a browser. Verify:
- 3-pane layout renders (left business list, center empty state, right panel)
- Stats bar shows numbers
- Business list populates (if there are businesses in the DB)
- Clicking a business shows its conversation in the center pane

- [ ] **Step 4: Commit**

```bash
git add client/index.html
git commit -m "feat(design): redesign admin panel to 3-pane WhatsApp ops console (Admin_A)"
```

---

## Task 8: Final build and dist update

**Files:**
- `client/platform/dist/` — rebuild with all component changes

- [ ] **Step 1: Full clean build**

```bash
cd client/platform && npm run build
```

Expected: completes with no errors. Output: `dist/assets/index-*.js` ~200KB.

- [ ] **Step 2: Verify routes in browser**

Open http://localhost:4242/platform/ — check:
- JobBoard: grayscale theme, chip filters, 3-column grid
- Click a job: two-column detail with sidebar
- /platform/profile: chip-based form with sections
- /platform/employer: jobs panel + AI match (from previous task)
- http://localhost:4242: new 3-pane admin panel

- [ ] **Step 3: Final commit with dist**

```bash
cd ../..
git add client/platform/dist/
git commit -m "build: rebuild platform dist with full design system redesign"
```

---

## Self-Review: Design Coverage

| Wireframe | Task | Status |
|-----------|------|--------|
| Design tokens (ink, muted, line, paper, accent) | Task 1 | ✅ |
| Inter + JetBrains Mono fonts | Task 1 | ✅ |
| JobCard with match bar + AI reason | Task 2 | ✅ |
| FilterBar: chip-based district + type | Task 3 | ✅ |
| Feed_C: grid layout, AI strip, section dividers | Task 4 | ✅ |
| Detail_B: two-column, sticky sidebar, AI match card | Task 5 | ✅ |
| Onboarding_B: chip field selectors, AI badge on bio | Task 6 | ✅ |
| Admin_A: 3-pane (business list + WA chat + fields) | Task 7 | ✅ |
| Business list with status dots | Task 7 | ✅ |
| WA chat bubbles (agent green right, company white left) | Task 7 | ✅ |
| Extracted fields panel (warm beige, DB log) | Task 7 | ✅ |
| Daily stats (dialogs, vacancies, messages) | Task 7 | ✅ |
