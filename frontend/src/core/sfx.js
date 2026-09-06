/**
 * Sfx — the whisper of Maya.
 *
 * Tiny WebAudio orchestrator for the seams between states: the chooser
 * revealing itself, a choice being made, the dark swallowing it again.
 * The AudioContext is created lazily inside a user gesture, so no
 * autoplay policy is ever violated.
 */

export class Sfx {
  constructor() {
    this.ctx = null;
  }

  _ac() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        /* audio unavailable — stay silent */
      }
    }
    return this.ctx;
  }

  _tone(freq0, freq1, dur, gain, type = "sine", delay = 0) {
    const ac = this._ac();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Two orbs unfurling — a little sparkle. */
  reveal() {
    this._tone(180, 260, 0.16, 0.05, "sine");
    this._tone(360, 540, 0.2, 0.025, "sine", 0.05);
  }

  /** A choice lands — soft settling tone. */
  choose() {
    this._tone(220, 180, 0.14, 0.05, "sine");
  }

  /** The listening orb ignites. */
  speakStart() {
    this._tone(140, 180, 0.2, 0.05, "triangle");
  }

  /** Back into the dark. */
  dismiss() {
    this._tone(200, 110, 0.18, 0.04, "sine");
  }
}