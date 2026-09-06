/**
 * Maya — the orchestrator.
 *
 * Owns the state machine:
 *   DORMANT → PROMPTING → TYPING / SPEAKING → THINKING → MATERIALIZED → DISSOLVING → DORMANT
 *
 * Privacy-first by default: the microphone stays off until the user summons
 * the Speak control. Tapping the dark reveals two options — Type and Speak —
 * that unfurl at the touch point, and the chosen interface materializes.
 * Trancriptions are routed through offline patterns first, then the Groq
 * backend, and the resolved intent to the tool registry + materializer.
 */

import { Audio } from "./audio.js";
import { VoiceRenderer } from "../visual/voice-renderer.js";
import { Materializer } from "./materializer.js";
import { Sfx } from "./sfx.js";
import { Registry } from "../tools/registry.js";
import { render } from "../ui/interfaces.js";
import { validate } from "../ui/spec.js";
import { Store } from "../session/store.js";
import { EventBus } from "../events/eventbus.js";
import "../tools/timer.js";
import "../tools/calculator.js";
import "../tools/stopwatch.js";
import "../tools/notes.js";
import "../tools/worldclock.js";
import "../tools/random.js";
import "../tools/filemaker.js";

const API_URL = window.MAYA?.apiUrl || "";

const RENDER_STATES = {
  dormant: "dormant",
  prompting: "prompting",
  typing: "dormant",
  voice: "listening",
  speaking: "speaking",
  thinking: "thinking",
  materialized: "materialized",
  dissolving: "dissolving",
};

export class Maya {
  constructor({ canvas, stage, promptEl, transcriptEl, whisperEl, chatEl, inputEl, chooserEl, voiceEl }) {
    this.canvas = canvas;
    this.stage = stage;
    this.promptEl = promptEl;
    this.transcriptEl = transcriptEl;
    this.whisperEl = whisperEl;
    this.chatEl = chatEl;
    this.inputEl = inputEl;
    this.chooserEl = chooserEl;
    this.voiceEl = voiceEl;

    this.renderer = null;
    this.materializer = new Materializer(stage);
    this.audio = null;
    this.state = "dormant";
    this.sfx = new Sfx();
    this._chooserPoint = null;
    this._capturing = false;
    this._lastToolRune = null;

    // One-Thing screen — a response or an interface, tracked as state.
    this.store = Store;
    this.surface = "response";
    this.interface = null;
    this._lastSpec = null;
    this._completionTimer = null;
    this._responseTimer = null;

    this._bindUI();
  }

  async init() {
    this.renderer = new VoiceRenderer(this.canvas);
    this.renderer.setState("dormant");
    this.renderer.start();
    this._enter("dormant");
  }

  _bindUI() {
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const text = this.inputEl.value.trim();
        if (text) this._captureAndSend(text);
      }
    });

    // The lamp's send light — a second, visible path to the same genie.
    const sendBtn = document.getElementById("maya-send");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        const text = this.inputEl.value.trim();
        if (text) this._captureAndSend(text);
      });
    }

    this.chooserEl.querySelector(".chooser-type").addEventListener("click", () => this._onChooseBtn("type"));
    this.chooserEl.querySelector(".chooser-speak").addEventListener("click", () => this._onChooseBtn("speak"));
    this.voiceEl.querySelector(".voice-btn").addEventListener("click", () => {
      this.sfx.dismiss();
      this._dismissVoice();
    });

    // The top-left anchor — a general-purpose light for future integrations;
    // for now it reveals a compact chat summary, never the whole thread.
    this.chatEl.querySelector(".chat-collapse").addEventListener("click", () => this._toggleSummary());

    // A tap on the dark while the summary is open folds it away — captured so
    // the tap never also summons the Type / Speak chooser beneath it.
    document.addEventListener("pointerdown", (e) => {
      const panel = this._summaryPanel();
      if (!panel || panel.hidden) return;
      const t = e.target && typeof e.target.closest === "function" ? e.target : null;
      if (t && t.closest(".maya-summary, .chat-collapse")) return;
      this._closeSummary();
      e.stopImmediatePropagation();
    }, true);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this._closeSummary();
    });

    // Tap the dark → summon the Type / Speak chooser at the screen's centre.
    document.addEventListener("pointerdown", (e) => {
      const t = e.target && typeof e.target.closest === "function" ? e.target : null;
      if (t && t.closest(".maya-tool, .maya-input, .chooser-btn, .maya-voice, .site-footer, #maya-file, .maya-chat")) return;
      if (this.materializer.active) return;
      if (this.state === "prompting") {
        this._dismissChooser();
        return;
      }
      // The composer is up — a tap on the dark folds it back into the calm.
      if (this.state === "typing") {
        this._dismissComposer();
        return;
      }
      if (this.state !== "dormant") return;
      this._openChooser();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.state === "prompting") this._dismissChooser();
      else if (this.state === "typing") this._dismissComposer();
    });
  }

  /* ------------------------------------------------------------------ *
   *  The chooser — Type / Speak, unfurling out of a point of light.
   * ------------------------------------------------------------------ */

  _openChooser() {
    this.promptEl.classList.add("is-hidden");
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.42; // the command band, clear of the reading dock
    const pt = { x: cx, y: cy };
    this._chooserPoint = pt;

    const c = this.chooserEl;
    c.classList.remove("is-dissolving");
    c.hidden = false;
    c.style.left = `${pt.x}px`;
    c.style.top = `${pt.y}px`;
    c.classList.remove("is-visible");
    void c.offsetWidth; // restart the stagger
    c.classList.add("is-visible");

    this.renderer.setFocus(pt.x, pt.y);
    this.renderer.burst(pt.x, pt.y);
    this.sfx.reveal();
    this._enter("prompting");
  }

  _dismissChooser(opts = {}) {
    const c = this.chooserEl;
    if (c.hidden) {
      if (!opts.instant) this._enter("dormant");
      return;
    }
    c.classList.remove("is-visible");
    c.classList.add("is-dissolving");
    if (opts.sound !== false) this.sfx.dismiss();
    setTimeout(() => {
      c.hidden = true;
      c.classList.remove("is-dissolving");
      if (this.state === "prompting") {
        this._enter("dormant");
        if (!this.materializer.active) this.promptEl.classList.remove("is-hidden");
      }
    }, opts.instant ? 0 : 460);
  }

  _onChooseBtn(mode) {
    this.sfx.choose();
    this._dismissChooser({ sound: false });
    if (mode === "type") {
      // The orbs dissolve into the point the box is born from.
      setTimeout(() => this._revealInput(), 240);
    } else {
      setTimeout(() => this._openVoice(), 320);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Type — a point of light blooms into the lamp at the screen's centre,
   *  then the lamp glides down to rest. No keyboard steal.
   * ------------------------------------------------------------------ */

  _revealInput() {
    const input = this.inputEl;
    input.classList.add("is-visible");

    // Measure the resting box, then lift it to the screen centre for its birth.
    const rect = input.getBoundingClientRect();
    const restY = rect.top + rect.height / 2;
    const lift = Math.max(0, restY - window.innerHeight / 2);
    if (lift > 0) input.style.setProperty("--lift", `${lift}px`);

    input.classList.remove("is-morphing");
    void input.offsetWidth;
    input.classList.add("is-morphing");
    this.sfx.choose();

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.renderer.burst(cx, cy);

    setTimeout(() => {
      input.classList.remove("is-morphing");
      input.style.removeProperty("--lift");
    }, 950);

    this._enter("typing");
  }

  _hideInput() {
    const input = this.inputEl;
    input.classList.remove("is-visible");
    input.classList.remove("is-morphing");
    input.style.removeProperty("--lift");
  }

  /** The resting state — the composer stays present once it has bloomed. */
  _rest() {
    this._enter(this.inputEl.classList.contains("is-visible") ? "typing" : "dormant");
  }

  /** Fold the composer back into the calm — Escape or a tap on the dark. */
  _dismissComposer() {
    if (!this.inputEl.classList.contains("is-visible")) return;
    this.inputEl.value = "";
    this._hideInput();
    this.promptEl.classList.remove("is-hidden");
    this._enter("dormant");
  }

  /**
   * The genie send — the words narrow and are drawn into the lamp, then the
   * lamp releases them as light and Maya answers.
   */
  async _captureAndSend(text) {
    if (this._capturing) return;
    this._capturing = true;
    const input = this.inputEl;
    const rect = input.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    input.classList.add("is-capturing");
    input.setAttribute("disabled", "");
    this.sfx.capture();

    // Wait for the lamp to swallow the words.
    await new Promise((r) => setTimeout(r, 560));

    input.classList.remove("is-capturing");
    input.removeAttribute("disabled");
    input.value = "";
    this._capturing = false;
    this._rest();

    // The lamp releases the words as light, then Maya materializes an answer.
    this.renderer.burst(cx, cy);
    await this._handleText(text);
  }

  /* ------------------------------------------------------------------ *
   *  Speak — the mic ignites on demand, rings breathe with the voice,
   *  and silence ends the turn.
   * ------------------------------------------------------------------ */

  async _openVoice() {
    const pt = this._chooserPoint || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const v = this.voiceEl;
    v.classList.remove("is-dissolving");
    v.hidden = false;
    v.style.left = `${pt.x}px`;
    v.style.top = `${pt.y}px`;
    v.classList.remove("is-visible");
    void v.offsetWidth;
    v.classList.add("is-visible");
    this.renderer.setFocus(pt.x, pt.y);
    this.sfx.speakStart();
    this._enter("voice");
    await this._startMic();
  }

  async _startMic() {
    if (this.audio) return;
    const v = this.voiceEl;
    this.audio = new Audio({
      onAmplitude: (rms) => {
        this.renderer.feed(rms);
        v.style.setProperty("--voi-amp", Math.min(1, rms * 6).toFixed(3));
      },
      onSpeechStart: () => this._enter("speaking"),
      onSpeechEnd: () => this._enter("thinking"),
      onFinalText: (text) => this._handleText(text),
    });
    try {
      await this.audio.start();
    } catch {
      this._dismissVoice(true);
      this._revealInput();
      this._say("Mic unavailable — type instead.");
      return;
    }
    if (v.hidden) {
      this.audio.stop();
      this.audio = null;
      return;
    }
    this._enter("voice");
  }

  _dismissVoice(instant = false) {
    const v = this.voiceEl;
    if (v.hidden) return;
    this.audio?.stop();
    this.audio = null;
    v.style.removeProperty("--voi-amp");
    v.classList.remove("is-visible");
    if (instant) {
      v.hidden = true;
      v.classList.remove("is-dissolving");
      return;
    }
    v.classList.add("is-dissolving");
    setTimeout(() => {
      v.hidden = true;
      v.classList.remove("is-dissolving");
    }, 560);
  }

  /* ------------------------------------------------------------------ *
   *  State
   * ------------------------------------------------------------------ */

  _enter(state) {
    this.state = state;
    if (this.renderer) this.renderer.setState(RENDER_STATES[state] || state);
    if (this.audio) this.audio.setSpeaking(state === "thinking" || state === "materialized");
    // The thinking whisper breathes only while Maya is working.
    if (this.whisperEl) this.whisperEl.hidden = state !== "thinking";
  }

  async _handleText(text) {
    if (!text) return;
    this._closeSummary();
    this._showTranscript(text);

    if (this.state === "voice" || this.state === "speaking" || this.state === "thinking") {
      this._dismissVoice();
    }

    // Tier 1 — instant on-device patterns.
    let intent = Registry.matchIntent(text);

    // Tier 2 — Groq/backend if patterns were inconclusive.
    if (!intent && API_URL) {
      this._enter("thinking");
      intent = await this._askBackend(text);
    }

    this._enter("materialized");

    // Phase 1 — a schema-driven interface: validate → render → mount → wire.
    if (intent && intent.ui_spec) {
      this._showInterface(intent.ui_spec, { reply: intent.reply });
      this._commitTurn(text, intent.reply || "There.", intent.experience || "ui");
      return;
    }

    // The backend answered without summoning a tool — show its words.
    if (intent && intent._spoke) {
      const reply = intent.reply || "There.";
      this._say(reply);
      this._commitTurn(text, reply);
      setTimeout(() => this._rest(), 1400);
      return;
    }

    if (!intent || !intent.experience) {
      const reply = intent?.reply || "I did not quite catch that. Try again?";
      this._say(reply);
      this._commitTurn(text, reply);
      setTimeout(() => this._rest(), 1400);
      return;
    }

    const el = Registry.create(intent.experience, intent.params);
    if (el) {
      // Listen for where the tool lands so particles migrate there.
      el.addEventListener("maya:landed", (e) => {
        const { x, y } = e.detail;
        this.renderer.setFocus(x, y);
        // Fade particles toward the landing spot, then back to the dark.
        setTimeout(() => this.renderer.setFocus(window.innerWidth / 2, window.innerHeight / 2), 2000);
      });

      // When the tool finishes, dissolve and hand its held reply to the One-Thing screen.
      el.addEventListener("maya:complete", () => this._onLegacyComplete(intent.reply));

      this.materializer.mount(el);
      // The interface is the one thing — the user's echo and any held reply
      // are blanked instantly; nothing is co-visible in the reading dock.
      this._dissolveResponse(true);
      this.surface = "interface";
      this.store.update({ surface: "interface", uiSpec: null, reply: intent.reply || null });
      this._commitTurn(text, intent.reply || "On it.", intent.experience);
    } else {
      const reply = `I don't know how to reveal "${intent.experience}" yet.`;
      this._say(reply);
      this._commitTurn(text, reply);
      setTimeout(() => this._rest(), 1400);
    }
  }

  async _askBackend(text) {
    try {
      const snapshot = this.store.snapshot();
      const res = await fetch(`${API_URL}/api/maya`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: this.store.get().conversation.slice(-8).map((turn) => ({
            role: turn.role,
            content: turn.text,
          })),
          session_id: snapshot.session_id,
          ui_state: snapshot.ui_state,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      // New shape — a schema-driven interface (Phase 1).
      if (data.ui_spec) {
        return {
          experience: (data.intent && data.intent.experience) || "ui",
          ui_spec: data.ui_spec,
          reply: data.reply,
        };
      }
      // Old shape — reply-only or a tool call.
      const tc = data.tool_calls?.[0];
      if (!tc) {
        if (data.response) return { _spoke: true, reply: data.response };
        return { _spoke: true, reply: "" };
      }
      return {
        experience: tc.name,
        params: tc.arguments || {},
        reply: data.response,
      };
    } catch {
      return null;
    }
  }

  _showTranscript(text) {
    const el = this.transcriptEl;
    el.textContent = text;
    el.classList.remove("is-dissolving", "is-quiet");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }

  _say(text) {
    if (!text) return;
    const el = this.transcriptEl;
    el.textContent = text;
    el.classList.remove("is-dissolving", "is-quiet");
    // The reply arrives bright, then settles into a calm & dim hold.
    setTimeout(() => el.classList.add("is-quiet"), 2200);
  }

  /* ------------------------------------------------------------------ *
   *  One-Thing screen — a response or an interface, never both.
   * ------------------------------------------------------------------ */

  /** The hand-off response — blooms at centre, rests low & calm. */
  _sayResponse(text) {
    if (!text) return;
    // While an interface lives, words are held, never shown beside it.
    if (this.surface === "interface") {
      this.store.update({ reply: text });
      return;
    }
    this._enter("materialized");
    const el = this.transcriptEl;
    el.textContent = text;
    el.classList.remove("is-dissolving", "is-quiet", "is-born");
    void el.offsetWidth;
    el.classList.add("is-born");
    if (this._responseTimer) clearTimeout(this._responseTimer);
    this._responseTimer = setTimeout(() => {
      el.classList.remove("is-born");
      el.classList.add("is-quiet");
    }, 1300);
  }

  /** Fold whatever response is on screen back into the dark.
    `instant` blanks it the moment a tool/interface claims the screen. */
  _dissolveResponse(instant = false) {
    const el = this.transcriptEl;
    if (!el || !el.textContent) return;
    if (this._responseTimer) clearTimeout(this._responseTimer);
    if (instant) {
      el.classList.remove("is-born", "is-quiet", "is-dissolving");
      el.textContent = "";
      return;
    }
    el.classList.remove("is-born", "is-quiet");
    el.classList.add("is-dissolving");
    this._responseTimer = setTimeout(() => {
      el.textContent = "";
      el.classList.remove("is-dissolving");
    }, 500);
  }

  /** The lead-in phrase whispers in the thinking breath, not the dock. */
  _whisper(text) {
    const w = this.whisperEl;
    if (!w || !text) return;
    const t = w.querySelector(".maya-whisper-text");
    if (t) t.textContent = text;
    w.hidden = false;
  }

  /** Public seam — present a validated UI spec on the One-Thing screen. */
  showSpec(spec, opts = {}) {
    return this._showInterface(spec, opts);
  }

  _showInterface(spec, { reply, sources } = {}) {
    const state = this.store.get();

    // Follow-up specs re-target the SAME mounted interface — no remount.
    if (this.interface && state.uiSpec && state.uiSpec.type === spec.type) {
      return this._retargetInterface(spec, sources || {});
    }

    this._cancelCompletion();
    this._dissolveResponse(true);

    const verdict = validate(spec);
    if (!verdict.ok) {
      this._sayResponse(reply || "I could not build that interface.");
      return null;
    }

    if (this.materializer.active) this.materializer.dismiss(true);

    const mergedSources = Object.assign({}, sourcesFromSpec(spec), sources || {});
    const handle = render(spec, { sources: mergedSources });
    if (!handle.ok) {
      this._sayResponse(reply || "I could not build that interface.");
      return null;
    }

    this.surface = "interface";
    this.interface = handle;
    this._lastSpec = spec;
    this.store.update({
      surface: "interface",
      intent: { task: spec.type },
      uiSpec: spec,
      componentStates: this._collectComponentStates(spec),
      results: null,
      reply: reply || null,
    });
    EventBus.emit("ui:spec", { spec });

    if (reply) this._whisper(reply);

    handle.subscribe((name, detail) => this._onUiEvent(name, detail));

    handle.el.addEventListener("maya:landed", (e) => {
      const { x, y } = e.detail;
      this.renderer.setFocus(x, y);
      setTimeout(() => this.renderer.setFocus(window.innerWidth / 2, window.innerHeight / 2), 2000);
    });

    handle.el.addEventListener("maya:complete", () => this._onInterfaceComplete(spec, reply));

    // The interface materializes and the lead-in fades with the whisper.
    this._enter("thinking");
    this.materializer.mount(handle.el);
    setTimeout(() => this._enter("materialized"), 900);
    return handle;
  }

  /** Re-target the live interface in place — apply new values and re-run. */
  _retargetInterface(spec, sources) {
    this._cancelCompletion();
    const handle = this.interface;
    const merged = Object.assign({}, sourcesFromSpec(spec), sources || {});
    for (const c of spec.components) {
      if (merged[c.id] !== undefined) handle.setValue(c.id, merged[c.id]);
    }
    for (const c of spec.components) {
      if (c.type !== "diff") continue;
      const slot = handle.slots.get(c.id);
      if (slot && slot.run) slot.run();
    }
    this._lastSpec = spec;
    this.store.update({
      uiSpec: spec,
      componentStates: this._collectComponentStates(spec),
      results: this._collectResults(spec),
    });
    EventBus.emit("ui:spec", { spec, retarget: true });
    return handle;
  }

  /** Interface user events → store + tool events. */
  _onUiEvent(name, detail) {
    const spec = this._lastSpec;
    if (!spec || !this.interface) return;
    if (name === "ui:change") {
      this.store.update({ componentStates: this._collectComponentStates(spec) });
      return;
    }
    if (name === "ui:action") {
      EventBus.emit("tool:run", { action: detail });
      for (const c of spec.components) {
        if (c.type !== "diff") continue;
        const slot = this.interface.slots.get(c.id);
        if (slot && slot.run) slot.run();
      }
      this.store.update({
        componentStates: this._collectComponentStates(spec),
        results: this._collectResults(spec),
      });
      EventBus.emit("tool:result", { results: this.store.get().results, action: detail });
      // Result → response hand-off: the interface yields, its result is spoken.
      this._scheduleCompletion();
    }
  }

  _collectComponentStates(spec) {
    const out = {};
    if (!this.interface) return out;
    for (const c of spec.components || []) {
      const slot = this.interface.slots.get(c.id);
      if (!slot) continue;
      const v = slot.getValue();
      if (v !== null && v !== undefined) out[c.id] = v;
    }
    return out;
  }

  _collectResults(spec) {
    const results = {};
    for (const c of spec.components || []) {
      if (c.type !== "diff") continue;
      const slot = this.interface && this.interface.slots.get(c.id);
      if (!slot) continue;
      const r = slot.getValue();
      if (r && r.stats) results[c.id] = r.stats;
    }
    return Object.keys(results).length ? results : null;
  }

  /** Legacy tool hand-off — dissolve, then its held reply becomes the one thing. */
  _onLegacyComplete(heldReply) {
    this._cancelCompletion();
    this.materializer.dismiss();
    if (this._lastToolRune) this._lastToolRune.classList.add("is-faded");
    this.surface = "response";
    this.store.update({ surface: "response", uiSpec: null, results: null, reply: heldReply || null });
    if (heldReply) this._sayResponse(heldReply);
    this._rest();
  }

  /** The result hand-off — interface dissolves, its result is the one thing. */
  _onInterfaceComplete(spec, leadIn) {
    this._cancelCompletion();
    this.materializer.dismiss();
    this.interface = null;
    const state = this.store.get();
    this.surface = "response";
    const reply = this._buildResultReply(spec) || state.reply || leadIn || "There.";
    this.store.update({ surface: "response", uiSpec: null, results: null, reply });
    this._sayResponse(reply);
    this._rest();
  }

  _buildResultReply(spec) {
    const results = this.store.get().results;
    if (!results) return null;
    const stats = Object.values(results)[0];
    if (!stats || typeof stats.removed === "undefined") return null;
    const names = { removed: stats.removed === 1 ? "line" : "lines" };
    return `done — ${stats.removed} ${names.removed} removed, ${stats.added} added.`;
  }

  _scheduleCompletion() {
    const delay = (window.MAYA && window.MAYA.completionDelay) || 1500;
    this._cancelCompletion();
    this._completionTimer = setTimeout(() => {
      const handle = this.interface;
      if (!handle) return;
      handle.el.classList.add("is-dissolving");
      handle.el.dispatchEvent(new CustomEvent("maya:complete"));
    }, delay);
  }

  _cancelCompletion() {
    if (this._completionTimer) {
      clearTimeout(this._completionTimer);
      this._completionTimer = null;
    }
  }

  /* ------------------------------------------------------------------ *
   *  The thread — each turn's words fly from the centre into a small,
   *  quiet conversation at the top-left; old lines sink into memory.
   * ------------------------------------------------------------------ */

  _commitTurn(userText, replyText, tool) {
    this._appendToChat(userText, { role: "user" });
    setTimeout(() => this._appendToChat(replyText, { role: "maya", tool }), 90);
    const convo = this.store.get().conversation || [];
    convo.push({ role: "user", text: userText });
    if (replyText) convo.push({ role: "maya", text: replyText, tool: tool || null });
    this.store.update({ conversation: convo.slice(-40) });
  }

  _appendToChat(text, { role, tool } = {}) {
    if (!text || !text.trim()) return;
    const entry = document.createElement("p");
    entry.className = `chat-entry entry-${role}`;
    if (tool) {
      const rune = document.createElement("span");
      rune.className = "chat-tool";
      rune.textContent = `⧖ ${tool}`;
      entry.append(document.createTextNode(text), rune);
      this._lastToolRune = rune;
    } else {
      entry.textContent = text;
    }
    this._flyInto(entry);
    this._settleThread();
  }

  _flyInto(entry) {
    this.chatEl.appendChild(entry);
    const target = entry.getBoundingClientRect();
    const origin = this.transcriptEl && !this.transcriptEl.classList.contains("is-dissolving")
      ? this.transcriptEl.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    const ox = origin.left + (origin.width || 0) / 2;
    const oy = origin.top + (origin.height || 0) / 2;
    const x = Math.round(ox - (target.left + target.width / 2));
    const y = Math.round(oy - (target.top + target.height / 2));
    entry.style.setProperty("--flyx", `${x}px`);
    entry.style.setProperty("--flyy", `${y}px`);
    entry.classList.add("is-flying");
    this.sfx.chime();
    const land = entry.getBoundingClientRect();
    setTimeout(() => {
      entry.classList.remove("is-flying");
      entry.style.removeProperty("--flyx");
      entry.style.removeProperty("--flyy");
      this.renderer.burst(land.left + land.width / 2, land.top + land.height / 2);
    }, 760);
  }

  _settleThread() {
    const chat = this.chatEl;
    const entries = Array.from(chat.querySelectorAll(".chat-entry"));
    while (entries.length > 20) entries.shift().remove();
    entries.forEach((el, i) => el.classList.toggle("is-dim", i < entries.length - 3));
    chat.classList.add("has-thread");
    const spine = chat.querySelector(".chat-spine");
    if (spine) spine.style.height = `${chat.scrollHeight}px`;
    const collapse = chat.querySelector(".chat-collapse");
    if (collapse && collapse.hidden) {
      collapse.hidden = false;
      collapse.setAttribute("aria-expanded", "false");
    }
  }

  /* ------------------------------------------------------------------ *
   *  The summary — the top-left anchor's one job for now: a compact
   *  digest of the conversation, never the raw thread. Future
   *  integrations claim the same anchor.
   * ------------------------------------------------------------------ */

  _toggleSummary() {
    const panel = this._summaryPanel();
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    this._setSummaryAria(!panel.hidden);
    if (!panel.hidden) this._renderSummary();
  }

  _closeSummary() {
    const panel = this._summaryPanel();
    if (panel && !panel.hidden) {
      panel.hidden = true;
      this._setSummaryAria(false);
    }
  }

  _summaryPanel() {
    return document.getElementById("maya-summary");
  }

  _setSummaryAria(open) {
    const collapse = this.chatEl.querySelector(".chat-collapse");
    if (collapse) collapse.setAttribute("aria-expanded", String(open));
  }

  _renderSummary() {
    const panel = this._summaryPanel();
    if (!panel) return;
    const list = panel.querySelector(".maya-summary-lines");
    const empty = panel.querySelector(".maya-summary-empty");
    const convo = this.store.get().conversation || [];
    list.textContent = "";
    if (!convo.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    const frag = document.createDocumentFragment();
    for (const turn of convo) {
      if (!turn || typeof turn.text !== "string" || !turn.text.trim()) continue;
      const li = document.createElement("li");
      li.className = `summary-line ${turn.role === "user" ? "line-user" : "line-maya"}`;
      const marker = document.createElement("span");
      marker.className = "summary-marker";
      marker.textContent = turn.role === "user" ? "you" : "maya";
      const body = document.createElement("span");
      body.className = "summary-text";
      let text = turn.text.replace(/\s+/g, " ").trim();
      if (text.length > 72) text = text.slice(0, 69) + "…";
      body.textContent = text;
      li.append(marker, body);
      if (turn.tool) {
        const rune = document.createElement("span");
        rune.className = "summary-tool";
        rune.textContent = `⧖ ${turn.tool}`;
        li.append(rune);
      }
      frag.append(li);
    }
    list.append(frag);
  }

  dispose() {
    this._cancelCompletion();
    if (this._responseTimer) clearTimeout(this._responseTimer);
    this.audio?.stop();
    this.renderer?.stop();
  }
}

/** Pull inline file values out of a spec so render/retarget can load them. */
function sourcesFromSpec(spec) {
  const sources = {};
  for (const c of spec.components || []) {
    if (c.type !== "file") continue;
    const v = c.value;
    if (typeof v === "string") sources[c.id] = { name: c.id, text: v };
    else if (v && typeof v === "object" && "text" in v) sources[c.id] = v;
  }
  return sources;
}