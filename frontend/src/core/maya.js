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

    this.chooserEl.querySelector(".chooser-type").addEventListener("click", () => this._onChooseBtn("type"));
    this.chooserEl.querySelector(".chooser-speak").addEventListener("click", () => this._onChooseBtn("speak"));
    this.voiceEl.querySelector(".voice-btn").addEventListener("click", () => {
      this.sfx.dismiss();
      this._dismissVoice();
    });

    // The thread's collapse dot — shrink or restore the conversation.
    this.chatEl.querySelector(".chat-collapse").addEventListener("click", () => this._toggleChatCollapse());

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
    const cy = window.innerHeight / 2;
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

      // When the tool finishes, dissolve and return to dormancy — its rune fades last.
      el.addEventListener("maya:complete", () => {
        this.materializer.dismiss();
        if (this._lastToolRune) this._lastToolRune.classList.add("is-faded");
        this._rest();
      });

      this.materializer.mount(el);
      this._say(intent.reply || "");
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
      const res = await fetch(`${API_URL}/api/maya`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: [] }),
      });
      if (!res.ok) return null;
      const data = await res.json();
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
    el.classList.remove("is-dissolving");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    setTimeout(() => el.classList.add("is-dissolving"), 1800);
  }

  _say(text) {
    if (!text) return;
    const el = this.transcriptEl;
    el.textContent = text;
    el.classList.remove("is-dissolving");
    setTimeout(() => el.classList.add("is-dissolving"), 2600);
  }

  /* ------------------------------------------------------------------ *
   *  The thread — each turn's words fly from the centre into a small,
   *  quiet conversation at the top-left; old lines sink into memory.
   * ------------------------------------------------------------------ */

  _commitTurn(userText, replyText, tool) {
    this._appendToChat(userText, { role: "user" });
    setTimeout(() => this._appendToChat(replyText, { role: "maya", tool }), 90);
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
    if (spine) spine.style.height = `${chat.classList.contains("is-collapsed") ? 0 : chat.scrollHeight}px`;
    const collapse = chat.querySelector(".chat-collapse");
    if (collapse && collapse.hidden) {
      collapse.hidden = false;
      collapse.setAttribute("aria-expanded", String(!chat.classList.contains("is-collapsed")));
    }
  }

  _toggleChatCollapse() {
    const chat = this.chatEl;
    const collapsed = chat.classList.toggle("is-collapsed");
    const collapse = chat.querySelector(".chat-collapse");
    if (collapse) collapse.setAttribute("aria-expanded", String(!collapsed));
    this._settleThread();
  }

  dispose() {
    this.audio?.stop();
    this.renderer?.stop();
  }
}