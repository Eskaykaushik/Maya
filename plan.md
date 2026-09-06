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

1. **Re-run full frontend verification** after the random/filemaker/worldclock pattern fixes — all 7 tools must materialize (tier-1).
2. **Push + deploy** (user approved "Push + deploy for me"):
   - Maya repo: verify/init git → commit frontend + readme + workflow → push to GitHub (`main`) → Pages workflow deploys `frontend/`.
   - kaushix-api repo: commit `agents/maya.py` → push to `github` remote (`git@github.com:Eskaykaushik/Kaushix-api-service.git`) → Render redeploys `/api/maya`.
3. **Fill `frontend/src/config.js` `apiUrl`** with the kaushix-api Render URL (currently `""` placeholder) so tier-2 routing works in production. Maya is fully standalone without it.
4. **Final browser cross-check** of the deployed GitHub Pages site (all 7 tools + dissolve + magical placement).
5. Optional later: add a favicon to silence the 404 console error.

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