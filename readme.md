 
# Maya

> **Ask. It appears.**

Maya is a conversation-first AI agent built around a simple idea:

**You shouldn't have to open an interface to use a tool.
The interface should appear when you need it.**

There is almost nothing on the screen.

Just darkness.

You speak.

You type.

And something appears.

---

## Quick Start

Maya is a **browser-first** experience: a zero-build, vanilla HTML/CSS/JS frontend where everything is localized and instant. Audio capture, speech-to-text, tool logic, and file generation all run **in the browser** — no bundlers, no frameworks, no Node toolchain. Intelligence is an *optional* enhancement hosted by the Kaushix API agent (`POST /api/maya`) on Render.

```bash
# Local run — the whole experience
python3 -m http.server 8080 --directory frontend
# open http://127.0.0.1:8080 and allow microphone access
```

That's it. Speak, and something appears.

> **No backend? No problem.** Without the Kaushix API, Maya still does everything — patterns handle intent, and every tool runs locally. The backend is consulted only for ambiguous requests and richer generated content. To enable it, set `apiUrl` in `frontend/src/config.js` to the Kaushix API Render URL (e.g. `https://kaushix-api-xxxx.onrender.com`), which exposes `/api/maya`.

**Deployment**

- Frontend → GitHub Pages (a `.github/workflows/pages.yml` deploy of `frontend/` on push to `main`).
- Intelligence → the `maya` agent inside [kaushix-api](https://github.com/Eskaykaushik/Kaushix-api-service), deployed on Render.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | Vanilla HTML / CSS / JS | The readme's philosophy demands restraint — no framework bloat |
| **Audio in** | Web Audio API · Web Speech API | Native capture, live amplitude/frequency analysis, on-device STT |
| **Voice visual** | `<canvas>` particle system | Real-time, zero-DOM, driven directly by the microphone data |
| **Placement** | Probabilistic layout engine | Interfaces land at a fresh, unpredictable point each time |
| **Intelligence (optional)** | kaushix-api `maya` agent · Groq native tool-calls | Only consulted for ambiguous intents / rich file content |
| **State** | Finite state machine | DORMANT → LISTENING → SPEAKING → THINKING → MATERIALIZED → DISSOLVING |

---

## The Experience

Maya doesn't feel like opening an application.

It feels like **summoning one**.

```text
                         nothing

                           ↓

                         "5 minute timer"

                           ↓

                    · · · · · · ·
                  ·             ·
                ·      TIMER      ·
                  ·             ·
                    · · · · · · ·

                           ↓

                       interaction

                           ↓

                        result

                           ↓

                    · · · · · · ·
                         fading

                           ↓

                         nothing
```

The interface has no reason to exist after the task is complete.

So it disappears.

---

## No Dashboard

Maya begins with almost nothing.

```text
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│                                             │
│                 What do you need?           │
│                                             │
│                    ─────                    │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

No grid of tools.

No sidebar full of features.

No application launcher.

No permanent cards.

**Just an intention.**

---

## Then Something Happens

Ask:

```text
"Set a timer for five minutes"
```

The darkness moves.

A subtle pulse.

A shape begins to form.

The timer emerges.

Not as a new page.

Not as a modal.

Not as a dashboard widget.

**It simply appears.**

```text
Darkness
    ↓
Presence
    ↓
Form
    ↓
Interaction
```

When the timer finishes:

```text
Form
  ↓
Dissolve
  ↓
Darkness
```

---

## Everything Is Summonable

A timer can appear.

A calculator can appear.

A chart can appear.

A map can appear.

A terminal can appear.

A workspace can appear.

A complex application can appear.

Maya decides what the request requires.

```text
                     USER
                       │
                       ▼
                    INTENT
                       │
                       ▼
                     MAYA
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
           SEARCH     CODE      DATA
             │         │         │
             └─────────┼─────────┘
                       ▼
                   EXPERIENCE
                       │
                       ▼
                    APPEARS
```

---

## Tools Become Physical

A tool is not merely an API call.

It has a **presence**.

```text
Timer
 ├── create
 ├── pause
 ├── resume
 └── cancel

        +

  visual identity

        ↓

   TIMER EXPERIENCE
```

Every capability can have its own way of materializing.

A chart might draw itself into existence.

A map might unfold from the darkness.

A calculator might assemble around the numbers.

A terminal might emerge line by line.

A diagram might grow from its center.

**The tool becomes the interface.**

---

## Complex Requests

Maya can summon multiple capabilities and combine them into one temporary experience.

For example:

```text
"Plan a 5 day Tokyo trip under ₹1 lakh"
```

Maya might invoke:

```text
Search
   ↓
Flights ──────┐
Hotels ───────┤
Weather ──────┤
Maps ─────────┤
Currency ─────┤
Calendar ─────┘
       ↓
   composition
       ↓
TRAVEL EXPERIENCE
```

The user never sees the machinery.

They see the result.

---

# The Magic

The visual language of Maya is deliberately restrained.

No excessive gradients.

No glowing neon cards.

No clutter.

No permanent UI.

Instead:

```text
black
+
space
+
light
+
motion
+
sound
```

The magic comes from **how things appear**.

### Emergence

Elements should feel as if they were already somewhere in the darkness and have just been revealed.

### Materialization

Interfaces should assemble rather than simply fade in.

```text
point
  ↓
line
  ↓
shape
  ↓
interface
```

### Presence

Nothing should feel like a normal HTML component being rendered.

It should feel like **something entering the space**.

### Dissolution

When an experience is no longer needed, it should return to where it came from.

```text
appear
  ↓
live
  ↓
respond
  ↓
complete
  ↓
dissolve
```

---

## The Interface Is Alive

Maya shouldn't rely on conventional UI transitions.

Instead, interfaces can:

* emerge from particles
* form from thin lines
* unfold from a point
* reveal themselves through light
* react to voice
* respond to cursor movement
* subtly breathe while active
* distort during transitions
* collapse when dismissed
* leave almost no trace

The goal isn't to make everything flashy.

The goal is to make the user wonder:

> **"Where did that come from?"**

---

## Architecture

```text
                         USER
                           │
                     voice / text
                           │
                           ▼
                    ┌────────────┐
                    │    MAYA    │
                    │            │
                    │ Understand │
                    │ Plan       │
                    │ Compose    │
                    └─────┬──────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ Tool Runtime │
                   └──────┬───────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           Search       Timer        Code
              │           │           │
              └───────────┼───────────┘
                          ▼
                  Experience Runtime
                          │
                          ▼
                    Materialization
                          │
                          ▼
                       INTERFACE
                          │
                          ▼
                       DISMISS
                          │
                          ▼
                       NOTHING
```

---

## Project Structure

```text
Maya/
├── readme.md
├── LICENSE                      MIT
├── .github/workflows/pages.yml   Deploys frontend/ to GitHub Pages on push to main
└── frontend/                    The magic — zero-build browser app
    ├── index.html               Empty dark canvas · home prompt · footer
    ├── styles/maya.css          Black theme · breathing · emergence/dissolve · placement
    └── src/
        ├── config.js            Optional apiUrl (kaushix-api) · placement tuning
        ├── main.js              Bootstraps and wires every module
        ├── core/
        │   ├── maya.js          State machine orchestrator
        │   ├── audio.js         Mic · AnalyserNode · VAD · SpeechRecognition
        │   └── materializer.js  Unpredictable placement + emergence/dissolution
        ├── visual/
        │   └── voice-renderer.js  Canvas particles · focus follows landing spot
        └── tools/
            ├── registry.js      Tool registration + intent routing
            ├── timer.js         Countdown / alarm ring
            ├── calculator.js    Arithmetic grid + voice expressions
            ├── stopwatch.js     Lap / elapsed
            ├── notes.js         Ephemeral scratchpad (localStorage)
            ├── worldclock.js    Live clocks, Intl timezones
            ├── random.js        Dice / coin / range picker
            └── filemaker.js     File generation + magical download
```

> **Intelligence** lives outside this repo: the `maya` agent in
> [kaushix-api](https://github.com/Eskaykaushik/Kaushix-api-service) (`agents/maya.py`),
> auto-registered at `POST /api/maya`, using Groq native tool-calling.

---

## Tool Registry

Tools are capabilities.

Experiences are their manifestations.

```python
Tool(
    name="timer",
    description="Create and control timers",
    actions=[
        "create",
        "pause",
        "resume",
        "cancel"
    ],
    experience="timer"
)
```

The agent produces intent:

```json
{
  "action": "create_timer",
  "duration": 300,
  "experience": "timer"
}
```

The runtime decides **how that intent becomes visible**.

Intent is produced in two tiers, layered for both speed and depth:

1. **Pattern matching (device-side, instant)** — simple rules catch the obvious ("timer five minutes", "5 + 7", "flip a coin", "make a csv file"). No network, no latency, so the interface responds the moment you speak.
2. **Kaushix API agent (`POST /api/maya`, optional)** — anything the patterns don't confidently resolve is sent to the `maya` agent, which uses Groq native **function-calling** to return structured `tool_calls` (name + arguments). Only consulted when needed — Maya is fully usable without it.

The two tiers share one contract, so upgrading the patterns never changes the experience layer.

---

## Creating a Tool

A tool has two halves: an **instantiation** (what Maya is told about it) and a **manifestation** (what the user sees). Maya is browser-first, so the runtime half lives entirely in the frontend; the agent is only a routing helper.

**1. Register the tool in the frontend** (`src/tools/`, e.g. `converter.js`):

```js
Registry.register({
  name: "converter",
  description: "Convert between units, currencies, and timezones",
  match: (text) => text.includes("convert") ?? null,   // offline pattern tier
});
Registry.implement("converter", (params) => {
  const el = document.createElement("div");
  el.className = "maya-tool is-live";
  el.innerHTML = `…`;                    // the interface
  el._maya = { destroy: () => { /* cleanup */ } };
  return el;                              // the element Maya materializes
});
```

Then import the tool in `core/maya.js` (which pulls it into the registry).

**2. (Optional) Let the Kaushix agent route to it** — add a matching function to `TOOLS` and a case in `run_tool` in `agents/maya.py`. This only matters when the device patterns don't resolve a request; the tool itself still runs entirely in the browser.

Everything the tool returns is materialized by `materializer.js` — you never touch the canvas or the state machine yourself. The tool *becomes* the interface, landing wherever the dark lets it.

---

## Magical Placement

Interfaces don't always appear in the center — that would be predictable, and nothing about Maya should be.

When a request resolves, the materializer picks a **fresh landing position** anywhere in a bounded region of the viewport, gently biased *away* from the previous spot so the tool never stacks. The voice-particle field migrates to that point as you finish speaking, so the interface emerges **out of your voice, exactly where it chose to appear**:

```text
speaking            speaking slows        landing chosen       interface
· · · drifting      · · ·   · · ·         · · · · · · →  ┌─────────┐
· · · · · ·    →    · ·· · · ··      →    ···   ···      │  timer   │
· · · · · ·         · · · · ··           · ·· · ·       └─────────┘
  everywhere          toward a               at one
                      point                 fresh point
```

Position, spacing, and region are tunable via `window.MAYA.placement` in `src/config.js`.

---

## File Generation

Ask for a file, and Maya writes it to your device — with ceremony.

Requests like *"make a CSV of my tasks"*, *"generate an SVG"*, or *"create a JSON file"* summon the `filemaker` tool. It typesets the filename, shows its size, and offers a download button. Press it, and a stream of light particles pours down through the button — the data visibly transferring into your device — before the file saves and the whole thing dissolves back into the dark.

Content for data formats (CSV, JSON, MD, HTML, SVG, code) is generated **in the browser** for zero latency. Rich or ambiguous content can be delegated to the Kaushix agent when `apiUrl` is configured.

---

## The State Machine

The magic is one loop, tracked in `core/maya.js`:

```text
DORMANT      darkness, a faint breathing pulse, always listening in the background
LISTENING    amplitude begins flowing; the canvas reacts to the world
SPEAKING     VAD fires; particles emerge, shaped by your voice
THINKING     silence returns; particles coalesce into your words, then dissolve
MATERIALIZED the tool emerges at a fresh, unpredictable point — you interact
DISSOLVING   the task is done; the form collapses back into darkness
DORMANT      nothing again
```

Each transition has a dedicated visual — nothing snaps. Presence is built in the seams between states.

---

## Roadmap

- **More browser-native tools** — unit converter, base converter, weather (Maya decides if it needs remote data and only then reaches for the agent).
- **Composition** — `Ask → Compose → Experience`: Maya summons *multiple* tools and combines them into one temporary experience (e.g. a Tokyo trip = search + flights + hotels + weather + maps + currency).
- **Smarter local routing** — a small on-device intent model so more requests resolve with zero latency and the agent is consulted even less.
- **Mixed audio** — complete the loop with output (TTS whispers, tone responses) so Maya can also be heard.
- **Wake word** — a quiet on-device spotter so Maya truly lives in the background until you call it.

---

## License

[MIT](LICENSE)

---

# The Philosophy

Traditional software works like this:

```text
Feature
   ↓
Build interface
   ↓
Put interface somewhere
   ↓
User finds interface
   ↓
User performs task
```

Maya reverses it.

```text
Intent
   ↓
Understand
   ↓
Create what is necessary
   ↓
Let the user interact
   ↓
Remove what is no longer necessary
```

The interface is no longer a destination.

**It is an event.**

---

# Vision

Today:

```text
Ask → Tool → Experience
```

Tomorrow:

```text
Ask → Compose → Experience
```

Eventually:

```text
Ask

↓

Maya understands what should exist

↓

Maya creates it

↓

You interact with it

↓

It disappears
```

The ultimate goal is not to build a collection of interfaces.

It is to build an intelligence capable of **creating interfaces on demand**.

---

```text
                 ASK
                  ↓
              UNDERSTAND
                  ↓
                THINK
                  ↓
               COMPOSE
                  ↓
             MATERIALIZE
                  ↓
              INTERACT
                  ↓
              COMPLETE
                  ↓
              DISSOLVE
                  ↓
               NOTHING
```

# Maya

> **Nothing until you ask.**
>
> **Everything when you need it.**
