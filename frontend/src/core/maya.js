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
  constructor({ canvas, stage, promptEl, transcriptEl, inputEl, chooserEl, voiceEl }) {
    this.canvas = canvas;
    this.stage = stage;
    this.promptEl = promptEl;
    this.transcriptEl = transcriptEl;
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

    // Tap the dark → summon the Type / Speak chooser at the touch point.
    document.addEventListener("pointerdown", (e) => {
      const t = e.target && typeof e.target.closest === "function" ? e.target : null;
      if (t && t.closest(".maya-tool, .maya-input, .chooser-btn, .maya-voice, .site-footer, #maya-file")) return;
      if (this.materializer.active) return;
      if (this.state === "prompting") {
        this._dismissChooser();
        return;
      }
      if (this.state !== "dormant") return;
      this._openChooser(e.clientX, e.clientY);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.state === "prompting") this._dismissChooser();
    });
  }

  /* ------------------------------------------------------------------ *
   *  The chooser — Type / Speak, unfurling out of a point of light.
   * ------------------------------------------------------------------ */

  _openChooser(x, y) {
    this.promptEl.classList.add("is-hidden");
    const pt = this._clampPoint(x, y - 84); // float above the finger
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

  _clampPoint(x, y) {
    const m = 96;
    const my = 168; // the vertical constellation needs room above and below
    return {
      x: Math.min(Math.max(m, x), window.innerWidth - m),
      y: Math.min(Math.max(my, y), window.innerHeight - my),
    };
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
    const pt = this._chooserPoint || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.sfx.choose();
    this._dismissChooser({ sound: false });
    if (mode === "type") {
      // The orbs dissolve into the point the box is born from.
      setTimeout(() => this._revealInput(), 240);
    } else {
      setTimeout(() => this._openVoice(pt.x, pt.y), 320);
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
    this._enter("dormant");

    // The lamp releases the words as light, then Maya materializes an answer.
    this.renderer.burst(cx, cy);
    await this._handleText(text);
  }

  /* ------------------------------------------------------------------ *
   *  Speak — the mic ignites on demand, rings breathe with the voice,
   *  and silence ends the turn.
   * ------------------------------------------------------------------ */

  async _openVoice(x, y) {
    const pt = this._clampPoint(x, y - 24);
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
  }

  async _handleText(text) {
    if (!text) return;
    this._showTranscript(text);
    this._hideInput();

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
      if (intent.reply) this._say(intent.reply);
      setTimeout(() => this._enter("dormant"), 1400);
      return;
    }

    if (!intent || !intent.experience) {
      this._say(intent?.reply || "I did not quite catch that. Try again?");
      setTimeout(() => this._enter("dormant"), 1400);
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

      // When the tool finishes, dissolve and return to dormancy.
      el.addEventListener("maya:complete", () => {
        this.materializer.dismiss();
        this._enter("dormant");
      });

      this.materializer.mount(el);
      this._say(intent.reply || "");
    } else {
      this._say(`I don't know how to reveal "${intent.experience}" yet.`);
      setTimeout(() => this._enter("dormant"), 1400);
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

  dispose() {
    this.audio?.stop();
    this.renderer?.stop();
  }
}