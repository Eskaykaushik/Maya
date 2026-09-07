# Maya — Build & Launch Plan

Maya is a dark, ephemeral, conversation-first AI agent. Tools materialize out of darkness on demand. Architecture is **browser-first**: audio, speech-to-text, tool logic, and file generation all run in the browser for zero latency; intelligence is an *optional* backend agent in kaushix-api (Render).

## Objective

- Vanilla HTML/CSS/JS frontend on **GitHub Pages** (no build step).
- Optional intelligence: `maya` agent in kaushix-api (`agents/maya.py`) → `POST /api/maya` on **Render**.
- 7 browser-native tools: timer, calculator, stopwatch, notes, worldclock, random, filemaker.
- Magical emergence and dissolution; voice-driven particles; "Hi, I am Maya" home screen with Dhwani-style footer.
- File generation with a magical download animation.
- Generative screen: one fixed centre slot, slow crossfades between states, no permanent UI.

## Current State

Maya is live at https://eskaykaushik.github.io/Maya/. The frontend is a zero-build vanilla JS app deployed via GitHub Pages. All 7 legacy tools materialize at distinct positions and work offline (tier-1 pattern routing). The optional tier-2 backend routes to kaushix-api on Render when patterns are inconclusive.

**Phase 1 is scaffolded and integrated:**
- `ui/spec.js` validator + `ui/primitives.js` ghost primitives + `ui/domain/diff.js` line-level LCS diff
- `ui/interfaces.js` renderer: `render(spec)` → `.maya-tool` element with `{getValue, setValue, subscribe, dispatch}`
- `events/eventbus.js` decouples session, UI primitives, and core orchestrator
- `session/store.js` observable `screen` model persisted to localStorage; `snapshot()` ships `ui_state` to backend
- `core/maya.js` One-Thing wiring: `_showInterface` / `_retargetInterface` (same-type re-target in place, no remount), `_sayResponse` (center bloom → rest-low), strict surface swap, result→response hand-off
- `core/materializer.js` single fixed centre slot with 1.25s crossfade dissolve / 1.4s unveil; clamps against sacred bottom band and top-left anchor zone
- On-screen chat thread removed; banner hides after first interaction; anchor dot reveals on first turn
- `tools/registry.js` offline **summon matcher** loses the tier-2 lottery for "show calc": `show/open/bring up <tool>` and bare `calc` mount the named tool instantly, zero backend calls (mid-session, any history depth)

**Backend (kaushix-api, separate repo):**
- `POST /api/maya` extended response shape: `{intent, ui_spec?, reply, tool_calls?}` (backward compatible)
- `schemas.py` Pydantic models; `sessions.py` in-memory session store (TTL 30 min, cap 1000 sessions)
- `services.py` `describe_screen()` turns `ui_state` into compact system note for follow-ups
- `agents/maya.py` tool-calling agent targeting `qwen/qwen3.8-27b`
- `agents/maya.py` PROMPT hardened: summon/open/name verbs emit the tool call **even mid-conversation** — short replies ("Here.") are lead-ins held behind the tool, never a substitute (kaushix-api `61b4869`, Redeployed)

## Active Plan

### 1. Document diff E2E proof

Wire the existing spec system into a real user flow end-to-end.

- **Frontend:** Ask → tier-2 intent `document_compare` → `ui_spec` returned → interface materializes at centre slot → user pastes/loads two texts → `ui:action{compare}` runs diff inside the interface → result coalesces → interface dissolves → spoken summary becomes the one response
- **Backend:** `agents/intent.py` maps NL to `document_compare` intent; `ui_generator.py` returns the diff spec
- **Done when:** Headless test passes all 5 steps; interface and response are never co-visible; follow-up ("only the liability changes") re-targets the same DOM node

### 2. Hardening & regression

Verify the system is solid before adding new capabilities.

- **7 legacy tools** still materialize correctly under the new centre-slot materializer
- **Reading-dock / composer zones** respected: no overlap with sacred bottom band or top-left anchor
- **Spec system** regression: `?spec=demo&auto=1` renders ghost UI + diff; 10/10 validator checks pass (unknown types, >4 components, grid layout, bad/dangling/dedup refs all rejected)
- **Crossfade timing**: 1.25s dissolve / 1.4s unveil feels calm, not sluggish
- **`node --check`** all ES modules; zero console/HTTP errors on live site
- **Done when:** All checks pass; no regressions in legacy tool behavior; new `?spec=` route stable

## Phase 1 — Schema-Driven Generated Interfaces

Moves Maya from `Ask → Tool → Experience` toward `User → Intent → Generated Interface → Tools → Result`. The model never emits code or HTML — it emits a **structured UI specification**; the frontend owns a validated ghost-primitive component library and renders it. Backend tools stay allowlisted with strict schemas.

### The Law — clean, less, aesthetic

Enforced by **schema, not taste**: the validator rejects clutter before it renders.

1. **Minimum-necessary spec.** Max **4 components** per interface, one **focal artifact** (the diff table, the waveform), at most a couple of quiet controls. Grid/dashboard layouts are not in the Phase-1 allowlist — `stack` only. A spec that looks like a dashboard is *rejected*, not rendered.
2. **Invisible primitives.** Every component inherits the ghost language — hairline `1px` borders, near-black `rgba(255,255,255,0.02)` fills, muted `0.62` text, one accent light per component, zero gradients/glow fields.
3. **Space over density.** Generous gaps; the interface is the artifact, not a frame around it.
4. **No decorative motion.** Only the existing emergence → live → dissolve; internal animation only where it communicates state.
5. **One thing at a time.** The screen holds a **response** (Maya's last utterance, persisted & calm) **or an interface** — never both. Follow-ups resolve against what is on screen; the state is tracked, not decoration.

### Contract — the UI spec (validated both sides)

```json
{
  "type": "document_diff",
  "components": [
    { "type": "file",   "id": "srcA", "label": "Contract A", "accept": ["txt","md"] },
    { "type": "file",   "id": "srcB", "label": "Contract B", "accept": ["txt","md"] },
    { "type": "button", "id": "compare", "label": "Compare" },
    { "type": "diff",   "id": "out", "sourceA": "srcA", "sourceB": "srcB" }
  ]
}
```

**Allowlist (Phase 1):** primitives `text · button · input · select · slider · toggle · file · metric`; domain `diff`. `layout` ∈ `stack` only. **Rejection rules** (spec rejected wholesale → client falls back to today's reply/behavior): >4 components, unknown component `type`, bad id references (e.g. `sourceA` not a file id), grid/dashboard layout.

### Frontend modules

| Module | Role |
|---|---|
| `ui/spec.js` | Validator + minimum-necessary guards (count, allowlist, id refs, layout) |
| `ui/primitives.js` | Ghost-styled renders: hairline `1px`, `rgba(255,255,255,0.02)` fills, `0.62` text, one accent |
| `ui/domain/diff.js` | Line-level LCS diff of two text sources → coalescing hairline result table |
| `ui/interfaces.js` | `render(spec)` → `.maya-tool` element + handle `{el, getValue, setValue, subscribe, dispatch}` |
| `events/eventbus.js` | `on/emit` for `intent · ui:spec · ui:action · tool:run · tool:result · session:update` |
| `session/store.js` | Observable state `{sessionId, intent, uiSpec, componentStates, results, conversation[]}`, persisted to localStorage; `snapshot()` → `ui_state` |
| `core/maya.js` | When a response carries `ui_spec`: validate → render → mount → wire `ui:action` events back into store/tools. Parses **old and new** backend shapes. Follow-up specs re-target the *same mounted* interface via `setValue` — no remount. Enforces the One-Thing swap. |

Existing 7 tools, composer, reading dock, materializer, and placement engine remain **untouched** (they gain the One-Thing hand-off, they don't change).

### One-Thing screen model

The active surface is tracked **state**, not decoration.

```js
screen = {
  surface: "response" | "interface",      // never both
  sessionId,
  intent: null | { task, inputs, operations },
  uiSpec: null | validatedSpec,            // live when surface = interface
  componentStates: { [id]: value },        // live values via ui:change
  results: null | { ... },                 // tool/domain output (diff counts, ...)
  reply: null | string,                    // current response text when surface = response
}
```

Enforcement in `core/maya.js`:
- **Surface swap:** `_showInterface(...)` clears/supersedes any on-screen response. A response while an interface lives is impossible.
- **Result → response hand-off:** on `maya:complete` the interface dissolves and its result is spoken as the one thing (`_sayResponse`). A tool with no result just calms.
- **Response placement:** replies bloom at screen center, then glide down to rest low & calm (`is-quiet`) above the composer.
- **Follow-ups understand the screen:** `session/store.js` keeps `screen`; `snapshot()` ships as `ui_state` so the next turn re-targets the live interface in place. No reload restoration in Phase 1.

### Backend changes — kaushix-api (separate repo, NOT committed here)

| Change | Why |
|---|---|
| `POST /api/maya` accepts `{message, session_id, history, ui_state}` → returns `{intent, ui_spec?, reply, tool_calls?}` (reply-only fallback, backward compatible) | The seam: session anchor for follow-ups + parsed intent + optional spec; frontend parses both old/new shapes |
| `schemas/{intent,ui,tools}.py` (Pydantic) | Model never emits arbitrary UI/code — validated structures only; count/layout guards enforce the Law server-side |
| `agents/intent.py` — NL + session context → `Intent` | Intent is first-class and UI-independent; session context resolves anaphora ("increase it a little") |
| `agents/ui_generator.py` — `Intent → UISpec`, allowlisted tasks only; unsupported → `ui_spec: null` + reply | "Generated interface" capability, bounded so the frontend never gets unrenderable specs |
| `sessions/store.py` — in-memory `session_id → {conversation, intent, ui_state, results}`, TTL/eviction; no Redis | Persistent task state; honest minimum for a modular monolith |
| `GET /sessions/{id}/events` — SSE **progress stub** (`thinking → planning → ui:generated → tool:running → done`) | Opens the streaming seam; event names mirror the frontend eventbus |
| Tool additions: `documents.extract_text` (txt/md; PDF/DOCX behind flag) + optional `POST /files` | Doc-compare proof needs real text and must show the UI ↔ tool loop |
| Tool additions: `web.search(query)` behind a provider-agnostic env adapter (`SEARCH_PROVIDER` + `SEARCH_API_KEY`) + `web.facts` (Wikipedia/Wikidata, keyless) | Web search as an allowlisted tool; provider choice deferred — one-line config swap later |
| `run_tool` + `TOOLS` formalized to JSON schemas; `documents.*` + `web.*` cases | Model chooses, runtime validates and executes; never model-written code |
| Per-session logs: intent decided, spec generated/forbidden, tool calls/results, failures | "Why this UI / why did the tool fail" answerable now; feeds later eval |

**Deliberately not doing now:** Redis/Postgres, microservices, new auth, OpenTelemetry, full streaming, arbitrary-task UI generation.

### Web search capability

Provider-agnostic by design — no provider committed yet.

- **`web.search(query)` tool in kaushix-api**, strict input/output schema, resolved through an env-keyed adapter (`SEARCH_PROVIDER` + `SEARCH_API_KEY`). When the provider decision lands, it's a config swap, not code.
- **`web.facts`** → keyless Wikipedia/Wikidata so search degrades gracefully to facts when the credit bucket is empty.
- **Result shape (locked): synthesized response.** Groq condenses sources into a calm answer → emitted as the one thing via `_sayResponse`. No new primitive, no spec domain, no frontend work — web search is invisible to the UI law.
- **Deferred:** provider choice, a `search_results` interface, streaming, citations UI.

### End-to-end proof — "compare two contracts"

1. Ask → tier-2 → intent `document_compare` → `ui_generator` returns the comparison spec.
2. The thinking whisper says "setting up comparison…"; the interface materializes at the centre slot — the screen now holds **only the interface** (response superseded).
3. Load two texts → `ui:action{compare}` → store updates → tool/diff runs → `tool:result` renders differences inside the interface.
4. "Only the liability changes" → snapshot (`ui_state`) to backend → updated spec → diff re-targets **in place** (no remount).
5. On completion the interface yields — the diff result becomes the **one response** at center, then rests low & calm.

### Increments & verification

- **A — Spec core (frontend):** Done (`983ea00`): `ui/spec.js` validator + `ui/primitives.js` + renderer + `ui/domain/diff.js` + `?spec=demo` route. *Verified: demo spec renders headless; 10/10 validator checks pass.*
- **B — Session + events + One-Thing:** Done (`7075204`): `events/eventbus.js`, `session/store.js`, `core/maya.js` One-Thing wiring. *Verified headless: interface mounts, compare runs, interface dissolves, response blooms; response and interface never co-visible; follow-up spec re-targets SAME DOM node; reload keeps sessionId + thread, restores no live interface.*
- **C — Backend (kaushix-api):** Done (`a7c5935`): schemas + intent/ui_generator + sessions + extended response + SSE stub + `web.search`/`web.facts` tool seam. *Verify: old + new shapes; allowlist rejects unknown spec types.*
- **D — Document compare E2E:** Ask → interface → files → diff → "liability only" narrows it. *Verify headless (Playwright-core + system Chrome).*
- **E — Hardening & regression:** 7 legacy tools still materialize; reading-dock/composer zones respected; spec system regression; crossfade timing; `node --check` all modules.

### Accepted defaults

- **A1:** compare = text (txt/md) client-side with paste-fallback; PDF/DOCX only if `extract_text` ships.
- **A2:** backend response reshapes to `{intent, ui_spec?, reply, tool_calls?}` with reply-only fallback kept.
- **A3:** SSE = progress stub, not full wire-up.

### Out of scope — roadmap later

Composition (multi-spec), more domains, streaming spec generation, React/TS migration decision, OpenTelemetry, Redis/Postgres, eval harness, personalization.

### Success criteria

- Schema pipeline keeps the screen **clean, less, aesthetic** — rejection rules prevent dashboard-like specs from rendering.
- **One thing at a time:** a response and an interface are never co-visible; any follow-up re-targets the on-screen interface from its live state (no remount, no guessing).
- The doc-compare proof is **useful and beautiful**, not a demo — and it evolves conversationally.
- Malformed/unsupported specs degrade to today's behavior; the 7 legacy tools are untouched.
- Every trace captures `session → intent → ui_spec → tool → result → final ui` (groundwork for later evaluation).
