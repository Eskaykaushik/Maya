/**
 * Maya — the orchestrator.
 *
 * Owns the state machine:
 *   DORMANT → TYPING / SPEAKING → THINKING → MATERIALIZED → DISSOLVING → DORMANT
 *
 * Privacy-first by default: the microphone stays off until summoned. Tapping
 * the dark blooms the text composer directly — the whole conversation is just
 * a tap + a few words. Transcriptions are routed through offline patterns
 * first, then the Groq backend, and the resolved intent to the tool registry
 * + materializer.
 *
 * The background chat thread is Maya's persistent conversation surface.
 * Tools take the fixed canvas at centre; the thread stays dim behind them.
 */

import { Audio } from "./audio.js";
import { VoiceRenderer } from "../visual/voice-renderer.js";
import { Materializer } from "./materializer.js";
import { Sfx } from "./sfx.js";
import { Capabilities } from "../capabilities/index.js";
import { render } from "../ui/interfaces.js";
import { validate } from "../ui/spec.js";
import { renderMarkdown } from "../ui/markdown.js";
import { Store } from "../session/store.js";
import { EventBus } from "../events/eventbus.js";

const API_URL = window.MAYA?.apiUrl || "";

const RENDER_STATES = {
  dormant: "dormant",
  typing: "dormant",
  voice: "listening",
  speaking: "speaking",
  thinking: "thinking",
  materialized: "materialized",
  dissolving: "dissolving",
};

export class Maya {
  constructor({ canvas, stage, promptEl, transcriptEl, whisperEl, chatEl, inputEl, voiceEl }) {
    this.canvas = canvas;
    this.stage = stage;
    this.promptEl = promptEl;
    this.transcriptEl = transcriptEl;
    this.whisperEl = whisperEl;
    this.chatEl = chatEl;
    this.inputEl = inputEl;
    this.voiceEl = voiceEl;

    // The background chat thread — Maya's persistent conversation surface.
    this.chatBgEl = document.getElementById("maya-chat-bg");
    this.chatThreadEl = document.querySelector(".chat-bg-thread");

    this.renderer = null;
    this.materializer = new Materializer(stage);
    this.audio = null;
    this.state = "dormant";
    this.sfx = new Sfx();
    this._capturing = false;

    // One-Thing screen — a response or an interface, tracked as state.
    this.store = Store;
    this.surface = "response";
    this.interface = null;
    this._lastSpec = null;
    this._completionTimer = null;
    this._responseTimer = null;
    this._pulseTimer = null;
    this._sessionStarted = false;

    this._bindUI();
  }

  async init() {
    this.renderer = new VoiceRenderer(this.canvas);
    this.renderer.setState("dormant");
    this.renderer.start();
    this._enter("dormant");

    // Wire materializer ↔ chat-bg focus transitions.
    this.materializer._onToolActive = () => this._dimChat();
    this.materializer._onToolInactive = () => this._undimChat();

    // Build the chat thread from any persisted conversation.
    this._buildChatFromStore();
  }

  /* ------------------------------------------------------------------ *
   *  Chat background — the persistent conversation surface.
   * ------------------------------------------------------------------ */

  _buildChatFromStore() {
    if (!this.chatThreadEl) return;
    this.chatThreadEl.textContent = "";
    const convo = this.store.get().conversation || [];
    for (const turn of convo) {
      if (!turn || typeof turn.text !== "string" || !turn.text.trim()) continue;
      this._appendChatRaw(turn.role, turn.text, turn.tool);
    }
  }

  /** Append a user or maya row to the background chat thread. */
  _appendChat(role, text, tool) {
    if (!this.chatThreadEl || !text) return;
    this._appendChatRaw(role, text, tool);
    this._autoScrollChat();
  }

  _appendChatRaw(role, text, tool) {
    const li = document.createElement("li");
    li.className = `chat-row ${role === "user" ? "is-user" : "is-maya"}`;

    const meta = document.createElement("span");
    meta.className = "chat-meta";

    const marker = document.createElement("span");
    marker.className = "chat-marker";
    marker.textContent = role === "user" ? "you" : "maya";
    meta.append(marker);

    if (tool) {
      const rune = document.createElement("span");
      rune.className = "chat-tool";
      rune.textContent = `⧖ ${tool}`;
      meta.append(rune);
    }

    const body = document.createElement("div");
    body.className = "chat-body";
    body.appendChild(renderMarkdown(text));

    li.append(meta, body);
    this.chatThreadEl.append(li);
  }

  _autoScrollChat() {
    if (!this.chatThreadEl) return;
    requestAnimationFrame(() => {
      this.chatThreadEl.scrollTop = this.chatThreadEl.scrollHeight;
    });
  }

  /** Recede the chat while a tool owns the canvas — interface only. */
  _dimChat() {
    if (this.chatBgEl) {
      this.chatBgEl.classList.add("is-dimmed");
      if (this.chatThreadEl) this.chatThreadEl.setAttribute("aria-hidden", "true");
      this._recedePrompt();
    }
  }

  /** Restore the chat when the tool dissolves. */
  _undimChat() {
    if (this.chatBgEl) {
      this.chatBgEl.classList.remove("is-dimmed");
      if (this.chatThreadEl) this.chatThreadEl.removeAttribute("aria-hidden");
      this._restorePrompt();
    }
  }

  /* ------------------------------------------------------------------ *
   *  Bind UI — input, voice, anchor, composer.
   * ------------------------------------------------------------------ */

  _bindUI() {
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const text = this.inputEl.value.trim();
        if (text) this._captureAndSend(text);
      }
    });

    const sendBtn = document.getElementById("maya-send");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        const text = this.inputEl.value.trim();
        if (text) this._captureAndSend(text);
      });
    }

    this.voiceEl.querySelector(".voice-btn").addEventListener("click", () => {
      this.sfx.dismiss();
      this._dismissVoice();
    });

    // Tap the dark → the composer blooms.
    document.addEventListener("pointerdown", (e) => {
      const t = e.target && typeof e.target.closest === "function" ? e.target : null;
      if (t && t.closest(".maya-tool, .maya-input, #maya-send, .maya-voice, .site-footer, #maya-file, .maya-chat, .maya-chat-bg")) return;
      if (this.materializer.active) return;
      if (this.state === "typing") {
        this._dismissComposer();
        return;
      }
      if (this.state !== "dormant") return;
      this._revealInput();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.materializer.active) {
        this._onUserClose();
        return;
      }
      if (this.state === "typing") this._dismissComposer();
    });
  }

  /* ------------------------------------------------------------------ *
   *  Session — first interaction reveals the chat background.
   * ------------------------------------------------------------------ */

  _sessionActive() {
    if (this._sessionStarted) return;
    this._sessionStarted = true;
    this.promptEl.classList.add("is-hidden");
    if (this.chatBgEl) this.chatBgEl.classList.add("is-visible");
  }

  /* ------------------------------------------------------------------ *
   *  Type — the composer blooms at the centre, rests low.
   * ------------------------------------------------------------------ */

  _revealInput() {
    const input = this.inputEl;
    this.promptEl.classList.add("is-hidden");
    input.classList.add("is-visible");

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

  /** Keep the anchor dot / prompt away while an interface owns the canvas. */
  _recedePrompt() {
    const btn = document.querySelector(".chat-collapse");
    if (!btn || btn.hidden) return;
    btn.hidden = true;
    if (this.promptEl) this.promptEl.classList.add("is-hidden");
  }

  _restorePrompt() {
    const btn = document.querySelector(".chat-collapse");
    if (!btn) return;
    btn.hidden = false;
  }

  _rest() {
    this._enter(this.inputEl.classList.contains("is-visible") ? "typing" : "dormant");
  }

  _dismissComposer() {
    if (!this.inputEl.classList.contains("is-visible")) return;
    this.inputEl.value = "";
    this._hideInput();
    if (!this._sessionStarted) this.promptEl.classList.remove("is-hidden");
    this._enter("dormant");
  }

  async _captureAndSend(text) {
    if (this._capturing) return;
    this._sessionActive();
    this._capturing = true;
    const input = this.inputEl;
    const rect = input.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    input.classList.add("is-capturing");
    input.setAttribute("disabled", "");
    this.sfx.capture();

    await new Promise((r) => setTimeout(r, 560));

    input.classList.remove("is-capturing");
    input.removeAttribute("disabled");
    input.value = "";
    this._capturing = false;
    this._rest();

    this.renderer.burst(cx, cy);
    await this._handleText(text);
  }

  /* ------------------------------------------------------------------ *
   *  Speak — the mic ignites on demand.
   * ------------------------------------------------------------------ */

  async _openVoice() {
    const r = this.inputEl.getBoundingClientRect();
    const pt = {
      x: r.left + r.width / 2,
      y: Math.round(r.top + r.height / 2) || window.innerHeight / 2,
    };
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
    if (this.whisperEl) this.whisperEl.hidden = state !== "thinking";
  }

  /* ------------------------------------------------------------------ *
   *  Handle text — intent routing.
   * ------------------------------------------------------------------ */

  async _handleText(text) {
    if (!text) return;
    this._sessionActive();

    if (this.state === "voice" || this.state === "speaking" || this.state === "thinking") {
      this._dismissVoice();
    }

    // Tier 1 — instant on-device patterns.
    let intent = Capabilities.resolve(text);

    // Tier 2 — Groq/backend if patterns were inconclusive.
    if (!intent && API_URL) {
      this._enter("thinking");
      intent = await this._askBackend(text);
    }

    this._enter("materialized");

    // Phase 1 — a schema-driven interface: validate → render → mount → wire.
    if (intent && intent.ui_spec) {
      const handle = this._showInterface(intent.ui_spec, { reply: intent.reply });
      if (!handle) {
        this._commitTurn(text, "I could not build that interface.");
        setTimeout(() => this._rest(), 400);
        return;
      }
      this._commitTurn(text, intent.reply || "There.", intent.experience || "ui");
      return;
    }

    // The backend answered without summoning a tool — show its words.
    if (intent && intent._spoke) {
      const reply = intent.reply || "There.";
      this._commitTurn(text, reply);
      setTimeout(() => this._rest(), 400);
      return;
    }

    if (!intent || !intent.experience) {
      const reply = intent?.reply || "I did not quite catch that. Try again?";
      this._commitTurn(text, reply);
      setTimeout(() => this._rest(), 400);
      return;
    }

    const el = Capabilities.materialize(intent.experience, intent.params);
    if (el) {
      el.addEventListener("maya:landed", (e) => {
        const { x, y } = e.detail;
        this.renderer.setFocus(x, y);
        setTimeout(() => this.renderer.setFocus(window.innerWidth / 2, window.innerHeight / 2), 2000);
      });

      el.addEventListener("maya:stream", (e) => {
        const { x, y } = e.detail;
        setTimeout(() => this.renderer.stream(x, y), 80);
      });

      el.addEventListener("maya:complete", () => this._onLegacyComplete(intent.reply));
      el.addEventListener("maya:close", () => this._onUserClose());

      this.materializer.mount(el);
      this._dissolveResponse(true);
      this.surface = "interface";
      this.store.update({ surface: "interface", uiSpec: null, reply: intent.reply || null });
      this._commitTurn(text, intent.reply || "On it.", intent.experience);
    } else {
      const reply = `I don't know how to reveal "${intent.experience}" yet.`;
      this._commitTurn(text, reply);
      setTimeout(() => this._rest(), 400);
    }
  }

  async _postMaya(base, payload, timeoutMs = 25000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await fetch(`${base}/api/maya`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  }

  async _askBackend(text) {
    if (!API_URL) return null;
    const snapshot = this.store.snapshot();
    const payload = {
      message: text,
      history: this.store.get().conversation.slice(-8).map((turn) => ({
        role: turn.role,
        content: turn.text,
      })),
      session_id: snapshot.session_id,
      ui_state: snapshot.ui_state,
    };
    const candidates = [API_URL, ...(window.MAYA?.fallbackApiUrls || [])].filter(Boolean);
    for (const base of candidates) {
      let data;
      try {
        const res = await this._postMaya(base, payload);
        if (!res.ok) continue;
        data = await res.json();
      } catch {
        continue;
      }
      if (data.ui_spec) {
        return {
          experience: (data.intent && data.intent.experience) || "ui",
          ui_spec: data.ui_spec,
          reply: data.reply,
        };
      }
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
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   *  Transcript — transient user echo at centre (brief, fades).
   * ------------------------------------------------------------------ */

  _showTranscript(text) {
    const el = this.transcriptEl;
    el.textContent = text;
    el.classList.remove("is-dissolving", "is-quiet");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    // The echo fades out quickly — the real thread lives in the chat bg.
    clearTimeout(this._transcriptFade);
    this._transcriptFade = setTimeout(() => {
      el.classList.add("is-dissolving");
      setTimeout(() => { el.textContent = ""; el.classList.remove("is-dissolving"); }, 1250);
    }, 900);
  }

  /** Maya's words — append to the background chat thread. */
  _say(text) {
    if (!text) return;
    this._appendChat("maya", text);
    this.store.update({ reply: text });
  }

  /** Replace the last Maya row's text in place — one bubble per turn, final wins. */
  _setLastMayaRow(text) {
    if (!text) return;
    if (!this.chatThreadEl) {
      this.store.update({ reply: text });
      return;
    }
    const rows = this.chatThreadEl.querySelectorAll(".chat-row.is-maya");
    if (!rows.length) {
      this._appendChat("maya", text);
      this.store.update({ reply: text });
      return;
    }
    const body = rows[rows.length - 1].querySelector(".chat-body");
    if (body) {
      body.textContent = "";
      body.appendChild(renderMarkdown(text));
    }

    const convo = this.store.get().conversation || [];
    for (let i = convo.length - 1; i >= 0; i--) {
      if (convo[i] && convo[i].role === "maya") {
        convo[i].text = text;
        break;
      }
    }
    this.store.update({ reply: text, conversation: convo.slice(-40) });
  }

  /* ------------------------------------------------------------------ *
   *  One-Thing screen — an interface on the fixed canvas, never both.
   * ------------------------------------------------------------------ */

  _sayResponse(text) {
    if (!text) return;
    if (this.surface === "interface") {
      this.store.update({ reply: text });
      return;
    }
    this._appendChat("maya", text);
    this.store.update({ reply: text });
    this._transitionPulse();
  }

  _transitionPulse() {
    let cy = window.innerHeight / 2;
    const el = this.interface && this.interface.el;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r && r.height) cy = r.top + r.height / 2;
    }
    const cx = window.innerWidth / 2;
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this.renderer.setFocus(cx, cy);
    this.renderer.surge(0.42, 1600);
  }

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
    }, 1250);
  }

  _whisper(text) {
    const w = this.whisperEl;
    if (!w || !text) return;
    const t = w.querySelector(".maya-whisper-text");
    if (t) t.textContent = text;
    w.hidden = false;
  }

  showSpec(spec, opts = {}) {
    const handle = this._showInterface(spec, opts);
    if (!handle) this._say(opts.reply || "I could not build that interface.");
    return handle;
  }

  _showInterface(spec, { reply, sources } = {}) {
    this._sessionActive();
    const state = this.store.get();

    if (this.interface && state.uiSpec && state.uiSpec.type === spec.type) {
      return this._retargetInterface(spec, sources || {});
    }

    this._cancelCompletion();
    this._dissolveResponse(true);

    const verdict = validate(spec);
    if (!verdict.ok) return null;

    const mergedSources = Object.assign({}, sourcesFromSpec(spec), sources || {});
    const handle = render(spec, { sources: mergedSources });
    if (!handle.ok) return null;

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

    handle.el.addEventListener("maya:stream", (e) => {
      const { x, y } = e.detail;
      setTimeout(() => this.renderer.stream(x, y), 80);
    });

    handle.el.addEventListener("maya:complete", () => this._onInterfaceComplete(spec, reply));
    handle.el.addEventListener("maya:close", () => this._onUserClose());

    this._enter("thinking");
    this.materializer.mount(handle.el);
    this._transitionPulse();
    setTimeout(() => this._enter("materialized"), 900);
    return handle;
  }

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
    this.renderer.setFocus(window.innerWidth / 2, window.innerHeight / 2);
    this.renderer.surge(0.25, 1200);
    EventBus.emit("ui:spec", { spec, retarget: true });
    return handle;
  }

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

  _onLegacyComplete(heldReply) {
    this._cancelCompletion();
    this.materializer.dismiss();
    this.surface = "response";
    this.store.update({ surface: "response", uiSpec: null, results: null, reply: heldReply || null });
    if (heldReply) this._setLastMayaRow(heldReply);
    this._rest();
  }

  _onInterfaceComplete(spec, leadIn) {
    this._cancelCompletion();
    this.materializer.dismiss();
    this.interface = null;
    const state = this.store.get();
    this.surface = "response";
    const reply = this._buildResultReply(spec) || state.reply || leadIn || "There.";
    this.store.update({ surface: "response", uiSpec: null, results: null, reply });
    this._setLastMayaRow(reply);
    this._rest();
  }

  /** The user closed the interface — dissolve it, keep the thread quiet. */
  _onUserClose() {
    this._cancelCompletion();
    this.materializer.dismiss();
    this.interface = null;
    this.surface = "response";
    const reply = this.store.get().reply || null;
    this.store.update({ surface: "response", uiSpec: null, results: null, reply });
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
   *  Turns — committed to store; also appended to the chat bg thread.
   * ------------------------------------------------------------------ */

  _commitTurn(userText, replyText, tool) {
    const convo = this.store.get().conversation || [];
    convo.push({ role: "user", text: userText });
    this._appendChat("user", userText);
    if (replyText) {
      convo.push({ role: "maya", text: replyText, tool: tool || null });
      this._appendChat("maya", replyText, tool);
    }
    this.store.update({ conversation: convo.slice(-40) });
  }

  dispose() {
    this._cancelCompletion();
    if (this._responseTimer) clearTimeout(this._responseTimer);
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    clearTimeout(this._transcriptFade);
    this.audio?.stop();
    this.renderer?.stop();
  }
}

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
