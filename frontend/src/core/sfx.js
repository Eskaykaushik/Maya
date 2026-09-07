/**
 * Sfx — the whisper of Maya.
 *
 * Tiny WebAudio orchestrator for the seams between states: the composer
 * blooming in, a word being captured, the dark swallowing it again.
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

  /** The input rises — light settling into a lamp. */
  choose() {
    this._tone(220, 190, 0.14, 0.05, "sine");
  }

  /** The genie inhale — words being drawn into the lamp. */
  capture() {
    this._tone(300, 560, 0.28, 0.045, "sine");
    this._tone(320, 950, 0.42, 0.02, "sine", 0.1);
    this._tone(700, 480, 0.12, 0.028, "triangle", 0.34);
  }

  /** The listening orb ignites. */
  speakStart() {
    this._tone(140, 180, 0.2, 0.05, "triangle");
  }

  /** A line landing in the thread — tiny glass chime. */
  chime() {
    this._tone(840, 1240, 0.18, 0.03, "sine");
    this._tone(1320, 1860, 0.22, 0.018, "sine", 0.07);
  }

  /** Back into the dark. */
  dismiss() {
    this._tone(200, 110, 0.18, 0.04, "sine");
  }
}