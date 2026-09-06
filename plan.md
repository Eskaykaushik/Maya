# Maya — Build & Launch Plan

Maya is a dark, ephemeral, conversation-first AI agent. Tools materialize out of darkness on demand. Architecture is **browser-first**: audio, speech-to-text, tool logic, and file generation all run in the browser for zero latency; intelligence is an *optional* backend agent in kaushix-api (Render).

## Objective
- Vanilla HTML/CSS/JS frontend on **GitHub Pages** (no build step).
- Optional intelligence: `maya` agent in kaushix-api (`agents/maya.py`) → `POST /api/maya` on **Render**.
- 7 browser-native tools: timer, calculator, stopwatch, notes, worldclock, random, filemaker.
- Magical, unpredictable placement of tool interfaces; voice-driven particles; "Hi, I am Maya" home screen with Dhwani-style footer.
- File generation with a magical download animation.

## Progress — COMPLETED

- **Readme** rewritten to final architecture: Quick Start (static frontend + optional kaushix-api), Tech Stack (browser-first), Project Structure (no `backend/`), two-tier intent (`POST /api/maya`), Creating a Tool (frontend Registry + kaushix-api `TOOLS`/`run_tool`), new **Magical Placement** + **File Generation** sections, Roadmap updated for browser-native direction.
- **Tool scaffold**: LICENSE (MIT), .gitignore.
- **Standalone `backend/` removed** from the Maya repo.
- **Home screen**: "Hi, I am Maya" prompt, Dhwani-style fixed footer (`Maya — everything you need, when you need it.` / `Built by Kaushix Labs · Shubham Kaushik`).
- **7 tools complete** in `frontend/src/tools/`: timer, calculator, stopwatch, notes (localStorage), worldclock (Intl timezones), random (dice/coin/range), filemaker (file generation + magical download stream).
- **Magical placement** in `core/materializer.js`: unpredictable landing position, biased away from previous spot; particle field migrates via `maya:landed`; config in `src/config.js` (`window.MAYA.placement`).
- **Voice → landing migration** in `visual/voice-renderer.js`; VAD + Web Speech/Web Audio in `core/audio.js`.
- **Orchestrator** `core/maya.js`: state machine, tier-1 pattern routing, tier-2 fetch to `/api/maya`, `maya:landed`/`maya:complete` events.
- **CSS**: black theme, breathing pulse, emergence/dissolve keyframes, `.maya-tool position:absolute`, `.is-live` anim combine, tool/footer/download styles.
- **kaushix-api agent**: `agents/maya.py` (TOOLS + `run_tool`, safe `_eval` calculator) targeting `qwen/qwen3.8-27b` (clean tool-calls JSON; `qwen3.6-27b` emits chain-of-thought → replaced).
- **kaushix-api tests** appended to `tests/test_api.py` — 3 pass (`test_maya_timer_tool_call`, `test_maya_calculator_tool_call`, `test_maya_endpoint`). Note: `tests/` is gitignored in that repo (local-only).
- **GitHub Actions** `.github/workflows/pages.yml` — deploys `frontend/` on push to `main`.
- **Frontend verified headless** (Playwright-core + system Chrome) at `http://127.0.0.1:8181`:
  - Home prompt `Hi, I am Maya` ✓ · footer ✓ · canvas ✓.
  - 5/7 tools materialized at distinct positions (timer, calculator, stopwatch, notes, worldclock). Bug fixes applied for random ("flip a coin" pattern) and filemaker ("make a csv file" pattern); worldclock offset float shown (-4.0h).
- **Readme update done** (full final-architecture rewrite).

## Plan — AHEAD

1. ~~**Re-run full frontend verification** after the random/filemaker/worldclock pattern fixes — all 7 tools must materialize (tier-1).~~ **Done** — all 7 tools materialize at distinct positions, zero console/HTTP errors. **Found & fixed:** worldclock offset bug (`worldclock.js`) was rendering the offset in minutes (`-240h`) instead of hours — now `-4.0h` (NY) / `+1.0h` (London) / `+5.5h` (Mumbai) etc., via a TZ-independent `getOffset`.
2. **Push + deploy** (user approved "Push + deploy for me"):
   - Maya repo: verify/init git → commit frontend + readme + workflow → push to GitHub (`main`) → Pages workflow deploys `frontend/`.
   - kaushix-api repo: commit `agents/maya.py` → push to `github` remote (`git@github.com:Eskaykaushik/Kaushix-api-service.git`) → Render redeploys `/api/maya`.
3. **Fill `frontend/src/config.js` `apiUrl`** with the kaushix-api Render URL (currently `""` placeholder) so tier-2 routing works in production. Maya is fully standalone without it.
4. **Final browser cross-check** of the deployed GitHub Pages site (all 7 tools + dissolve + magical placement).
5. ~~Optional later: add a favicon to silence the 404 console error.~~ **Done** — added `frontend/favicon.svg` + link in `frontend/index.html`.

## Blocked / Notes
- kaushix-api Render URL unknown (needed only for `apiUrl`).
- kaushix-api `test_fallbacks.py` failures are pre-existing, unrelated to Maya.
- Port 8000 occupied by Dhwani locally (verification uses 8181).
- Maya repo git state not yet confirmed (init/remote pending).
- Backend `/api/maya` real-Groq smoke test already passed earlier (timer/calculator/filemaker/random tool-calls + chat reply).

## Key Files
- `frontend/src/core/maya.js` · `materializer.js` · `audio.js`
- `frontend/src/visual/voice-renderer.js`
- `frontend/src/tools/` (`registry.js` + 7 tools)
- `frontend/src/config.js` · `frontend/index.html` · `frontend/styles/maya.css`
- `.github/workflows/pages.yml` · `readme.md`
- kaushix-api: `agents/maya.py` · `tests/test_api.py`

---

# Phase 1 — Schema-Driven Generated Interfaces

Moves Maya from `Ask → Tool → Experience` toward `User → Intent → Generated Interface → Tools → Result`. The model never emits code or HTML — it emits a **structured UI specification**; the frontend owns a validated ghost-primitive component library and renders it. Backend tools stay allowlisted with strict schemas.

## The Law — clean, less, aesthetic

Enforced by **schema, not taste**: the validator rejects clutter before it renders.

1. **Minimum-necessary spec.** Max **4 components** per interface, one **focal artifact** (the diff table, the waveform), at most a couple of quiet controls. Grid/dashboard layouts are not in the Phase-1 allowlist — `stack` only. A spec that looks like a dashboard is *rejected*, not rendered.
2. **Invisible primitives.** Every component inherits the ghost language — hairline `1px` borders, near-black `rgba(255,255,255,0.02)` fills, muted `0.62` text, one accent light per component, zero gradients/glow fields. Same restraint as the orbs/composer overhaul.
3. **Space over density.** Generous gaps; the interface is the artifact, not a frame around it.
4. **No decorative motion.** Only the existing emergence → live → dissolve; internal animation only where it communicates state (e.g. diff result coalescing in).
5. **One thing at a time.** The screen holds a **response** (Maya's last utterance, persisted & calm) **or an interface** — never both. Follow-ups resolve against what is on screen; the state is tracked, not decoration.

## Contract — the UI spec (validated both sides)

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

## Frontend changes — `frontend/` (vanilla, zero-build, no deps)

| Module | Role |
|---|---|
| `ui/spec.js` | ~100-line validator + minimum-necessary guards (count, allowlist, id refs, layout) |
| `ui/primitives/` | Ghost-styled renders: hairline `1px`, `rgba(255,255,255,0.02)` fills, `0.62` text, one accent — matching the orbs/composer restraint |
| `ui/domain/diff.js` | Line-level LCS diff of two text sources → coalescing hairline result table |
| `ui/interfaces.js` | `render(spec)` → `.maya-tool` element + handle `{el, getValue, setValue, subscribe, dispatch}`; mounts through the existing `Materializer` (placement, `maya:landed`/`maya:complete` preserved) |
| `events/eventbus.js` | `on/emit` for `intent · ui:spec · ui:action · tool:run · tool:result · session:update` |
| `session/store.js` | Observable state `{sessionId, intent, uiSpec, componentStates, results, conversation[]}`, persisted to localStorage; sends a compact snapshot to the backend for follow-ups |
| `core/maya.js` | When a response carries `ui_spec`: validate → render → mount → wire `ui:action` events back into store/tools. Parses **old and new** backend shapes. Follow-up specs (`"show only the liability clauses"`) re-target the *same mounted* interface via `setValue` — no remount. Enforces the One-Thing swap (below) |

Existing 7 tools, composer, reading dock, materializer, and placement engine remain **untouched** (they gain the One-Thing hand-off, they don't change).

## One-Thing screen model

The active surface is tracked **state**, not decoration — this is what "Maya understands what's on screen" means.

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
- **Surface swap:** `_showInterface(...)` clears/supersedes any on-screen response (the lead-in phrase, e.g. "comparing contracts…", moves into the thinking whisper instead of the reading dock). A response while an interface lives is impossible.
- **Result → response hand-off:** on `maya:complete` the interface dissolves and its result is spoken as the one thing (`_sayResponse`). A tool with no result just calms.
- **Response placement:** replies **bloom at screen center**, then glide down to rest low & calm (`is-quiet`) above the composer. No `has-tool` dim — strict swap instead.
- **Follow-ups understand the screen:** `session/store.js` keeps `screen`; `snapshot()` ships as `ui_state` so the next turn re-targets the live interface in place (component values + results as context). No reload restoration in Phase 1.

## Backend changes — kaushix-api (separate repo, NOT committed here)

| Change | Why |
|---|---|
| `POST /api/maya` accepts `{message, session_id, history, ui_state}` → returns `{intent, ui_spec?, reply, tool_calls?}` (reply-only fallback, backward compatible) | The seam: session anchor for follow-ups + parsed intent + optional spec; frontend parses both old/new shapes |
| `schemas/{intent,ui,tools}.py` (Pydantic) | Model never emits arbitrary UI/code — validated structures only; count/layout guards enforce the Law server-side |
| `agents/intent.py` — NL + session context → `Intent` | Intent is first-class and UI-independent; session context resolves anaphora ("increase it a little") |
| `agents/ui_generator.py` — `Intent → UISpec`, allowlisted tasks only; unsupported → `ui_spec: null` + reply | "Generated interface" capability, bounded so the frontend never gets unrenderable specs |
| `sessions/store.py` — in-memory `session_id → {conversation, intent, ui_state, results}`, TTL/eviction; no Redis | Persistent task state (§7); honest minimum for a modular monolith |
| `GET /sessions/{id}/events` — SSE **progress stub** (`thinking → planning → ui:generated → tool:running → done`) | Opens the streaming seam (§11); event names mirror the frontend eventbus |
| Tool additions: `documents.extract_text` (txt/md; PDF/DOCX behind flag) + optional `POST /files` | Doc-compare proof needs real text and must show the UI ↔ tool loop (stretch by default) |
| Tool additions: `web.search(query)` behind a provider-agnostic env adapter (`SEARCH_PROVIDER` + `SEARCH_API_KEY`) + `web.facts` (Wikipedia/Wikidata, keyless) | Web search as an allowlisted tool (§12); provider choice deferred — one-line config swap later |
| `run_tool` + `TOOLS` formalized to JSON schemas; `documents.*` + `web.*` cases | Model chooses, runtime validates and executes; never model-written code (§12) |
| Per-session logs: intent decided, spec generated/forbidden, tool calls/results, failures | "Why this UI / why did the tool fail" answerable now; feeds later eval (§13/§14) |

**Deliberately not doing now:** Redis/Postgres, microservices, new auth, OpenTelemetry, full streaming, arbitrary-task UI generation.

## Web search capability

Provider-agnostic by design — no provider committed yet.

- **`web.search(query)` tool in kaushix-api**, strict input/output schema, resolved through an env-keyed adapter (`SEARCH_PROVIDER` + `SEARCH_API_KEY`). When the provider decision lands (Tavily 1,000 credits/mo free · Serper 2,500/mo free · failover), it's a config swap, not code.
- **`web.facts`** → keyless Wikipedia/Wikidata so search **degrades gracefully** to facts when the credit bucket is empty — provider-independent, buildable now.
- **Result shape (locked): synthesized response.** Groq (already free in-stack) condenses sources into a calm answer → emitted as the one thing via `_sayResponse` (center bloom → reading dock). **No new primitive, no spec domain, no frontend work** — web search is invisible to the UI law.
- **Deferred:** provider choice, a `search_results` interface (would need a new primitive + domain), streaming, citations UI.

## End-to-end proof — "compare two contracts"

1. Ask → tier-2 → intent `document_compare` → `ui_generator` returns the comparison spec.
2. The thinking whisper says "setting up comparison…"; the interface materializes at a fresh point (placement engine) — the screen now holds **only the interface** (response superseded).
3. Load two texts → `ui:action{compare}` → store updates → tool/diff runs → `tool:result` renders differences inside the interface.
4. "Only the liability changes" → snapshot (`ui_state`) to backend → updated spec → diff re-targets **in place** (no remount).
5. On completion the interface yields — the diff result (e.g. "4 sections differ — liability & fees") becomes the **one response** at center, then rests low & calm.

## Increments & verification

- **A — Spec core (frontend):** validator + ghost primitives + renderer + `?spec=demo` route. *Verify: demo spec renders; unknown/monster (>4 components, grid) specs rejected.*
- **B — Session + events + One-Thing:** store (`screen` model), eventbus, action→store wiring, follow-up path + no-remount re-target, exclusivity swap (interface ≁ response), result→response hand-off, response center-bloom → rest-low. *Verify: response and interface are never co-visible; on complete the result becomes the single response; follow-up applies to the live interface with no remount.*
- **C — Backend (kaushix-api):** schemas + intent/ui_generator + sessions + extended response + SSE stub + `web.search`/`web.facts` tool seam. *Verify: old + new shapes; allowlist rejects unknown spec types.*
- **D — Document compare E2E:** ask → interface → files → diff → "liability only" narrows it. *Verify headless (Playwright-core + system Chrome, per existing convention).*
- **E — Hardening & regression:** 7 legacy tools still materialize; reading-dock/composer zones respected (no overlap); `node --check` all modules; readme "Creating a Tool" updated for spec-driven tools.

## Accepted defaults
- **A1:** compare = text (txt/md) client-side with paste-fallback; PDF/DOCX only if `extract_text` ships.
- **A2:** backend response reshapes to `{intent, ui_spec?, reply, tool_calls?}` with reply-only fallback kept.
- **A3:** SSE = progress stub, not full wire-up.

## Out of scope — roadmap later
Composition (multi-spec), more domains, streaming spec generation, React/TS migration decision, OpenTelemetry, Redis/Postgres, eval harness, personalization.

## Success criteria
- Schema pipeline keeps the screen **clean, less, aesthetic** — rejection rules prevent dashboard-like specs from rendering.
- **One thing at a time:** a response and an interface are never co-visible; any follow-up re-targets the on-screen interface from its live state (no remount, no guessing).
- The doc-compare proof is **useful and beautiful**, not a demo — and it evolves conversationally.
- Malformed/unsupported specs degrade to today's behavior; the 7 legacy tools are untouched.
- Every trace captures `session → intent → ui_spec → tool → result → final ui` (groundwork for later evaluation).