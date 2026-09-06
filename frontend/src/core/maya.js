/**
 * Maya — the orchestrator.
 *
 * Owns the state machine:
 *   DORMANT → LISTENING → SPEAKING → THINKING → MATERIALIZED → DISSOLVING → DORMANT
 *
 * Wires the microphone capture + analyser to the particle renderer, the
 * transcription to the intent layer (offline patterns first, then the
 * Groq backend), and the resulting intent to the tool registry + materializer.
 *
 * Tools land at a fresh, unpredictable position each time — the voice
 * particles migrate there, and the interface emerges from that spot.
 */

import { Audio } from "./audio.js";
import { VoiceRenderer } from "../visual/voice-renderer.js";
import { Materializer } from "./materializer.js";
import { Registry } from "../tools/registry.js";
import "../tools/timer.js";
import "../tools/calculator.js";
import "../tools/stopwatch.js";
import "../tools/notes.js";
import "../tools/worldclock.js";
import "../tools/random.js";
import "../tools/filemaker.js";

const API_URL = window.MAYA?.apiUrl || "";

export class Maya {
  constructor({ canvas, stage, promptEl, transcriptEl, inputEl }) {
    this.canvas = canvas;
    this.stage = stage;
    this.promptEl = promptEl;
    this.transcriptEl = transcriptEl;
    this.inputEl = inputEl;

    this.renderer = null;
    this.materializer = new Materializer(stage);
    this.audio = null;
    this.state = "dormant";

    this._bindUI();
  }

  async init() {
    this.renderer = new VoiceRenderer(this.canvas);
    this.renderer.setState("dormant");
    this.renderer.start();

    try {
      this.audio = new Audio({
        onAmplitude: (rms) => this.renderer.feed(rms),
        onSpeechStart: () => this._enter("speaking"),
        onSpeechEnd: () => this._enter("thinking"),
        onFinalText: (text) => this._handleText(text),
      });
      await this.audio.start();
      if (!this.audio.supportsSpeech) this._revealInput();
      this._enter("listening");
    } catch {
      this._revealInput();
      this._enter("listening");
    }
  }

  _bindUI() {
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const text = this.inputEl.value.trim();
        if (text) {
          this._handleText(text);
          this.inputEl.value = "";
        }
      }
    });

    // Make typing reachable even when the mic works: reveal + focus the input
    // on the first click or keypress, so the keyboard path is always available.
    document.addEventListener("pointerdown", () => {
      if (!this.inputEl.classList.contains("is-visible")) this._revealInput();
    });
    document.addEventListener("keydown", (e) => {
      if (this.inputEl.classList.contains("is-visible")) return;
      if (e.target !== document.body) return;
      this._revealInput();
      // keydown precedes the character insertion; re-add a printable key.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.inputEl.value += e.key;
      }
    });
  }

  _revealInput() {
    this.inputEl.classList.add("is-visible");
    this.inputEl.focus({ preventScroll: true });
  }

  _enter(state) {
    this.state = state;
    this.promptEl.classList.toggle("is-hidden", state !== "dormant");
    if (this.renderer) this.renderer.setState(state);
    if (this.audio) this.audio.setSpeaking(state === "thinking" || state === "materialized");
  }

  async _handleText(text) {
    if (!text) return;
    this._showTranscript(text);

    // Tier 1 — instant on-device patterns.
    let intent = Registry.matchIntent(text);

    // Tier 2 — Groq backend if patterns were inconclusive.
    if (!intent && API_URL) {
      this._enter("thinking");
      intent = await this._askBackend(text);
    }

    this._enter("materialized");

    if (!intent || !intent.experience) {
      this._say(intent?.reply || "I did not quite catch that. Try again?");
      setTimeout(() => this._enter("listening"), 1400);
      return;
    }

    const el = Registry.create(intent.experience, intent.params);
    if (el) {
      // Listen for where the tool lands so particles migrate there.
      el.addEventListener("maya:landed", (e) => {
        const { x, y } = e.detail;
        this.renderer.setFocus(x, y);
        // Fade particles toward the landing spot, then back to listening.
        setTimeout(() => this.renderer.setFocus(window.innerWidth / 2, window.innerHeight / 2), 2000);
      });

      // When the tool finishes, dissolve and return to listening.
      el.addEventListener("maya:complete", () => {
        this.materializer.dismiss();
        this._enter("listening");
      });

      this.materializer.mount(el);
      this._say(intent.reply || "");
    } else {
      this._say(`I don't know how to reveal "${intent.experience}" yet.`);
      setTimeout(() => this._enter("listening"), 1400);
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
        this._say(data.response || "");
        return null;
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
