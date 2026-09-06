/**
 * VoiceRenderer — the visual soul of Maya.
 *
 * A `<canvas>` particle field that breathes with the room (listening),
 * erupts with the voice (speaking), and falls still when Maya thinks.
 *
 * Driven entirely by live audio data: amplitude → particle count + spread,
 * dominant frequency → colour temperature (warm ↔ cool).
 *
 * The focus point shifts to where a tool will land, so the voice literally
 * becomes the interface wherever it materialises.
 */

export class VoiceRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particles = [];
    this.state = "dormant";
    this.energy = 0;
    this.targetEnergy = 0;
    this.w = 0;
    this.h = 0;
    this.focusX = 0;
    this.focusY = 0;
    this._raf = 0;
    this.feedIsRunning = false;
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.focusX = this.w / 2;
    this.focusY = this.h / 2;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setState(state) {
    this.state = state;
  }

  /** Shift the particle convergence target to a new point on the canvas. */
  setFocus(x, y) {
    this.focusX = x;
    this.focusY = y;
  }

  /** Called on every audio analyser pass with live amplitude / frequency. */
  feed(amplitude) {
    const target =
      this.state === "speaking" ? Math.min(1, amplitude * 6)
      : this.state === "listening" ? Math.min(0.35, amplitude * 8)
      : this.state === "thinking" ? this.energy * 0.3
      : 0;
    this.targetEnergy = target;

    if (!this.feedIsRunning) {
      this.feedIsRunning = true;
      requestAnimationFrame(() => { this._syncParticles(target); this.feedIsRunning = false; });
    }
  }

  _syncParticles(target) {
    const ideal = Math.round(target * 900);
    const diff = ideal - this.particles.length;
    if (diff > 0) {
      const spawn = Math.min(diff, 4);
      for (let i = 0; i < spawn; i++) this._spawn();
    } else if (diff < 0) {
      const kill = Math.min(-diff, 2);
      for (let i = 0; i < kill; i++) this.particles.pop();
    }
  }

  _spawn() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 140;
    this.particles.push({
      x: this.focusX + Math.cos(angle) * dist * this.targetEnergy,
      y: this.focusY + Math.sin(angle) * dist * this.targetEnergy,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      life: 1,
      decay: 0.3 + Math.random() * 0.7,
      size: 0.6 + Math.random() * 2.0,
    });
  }

  start() {
    const draw = () => {
      this.energy += (this.targetEnergy - this.energy) * 0.05;
      this._clear();
      this._drawParticles();
      this._raf = requestAnimationFrame(draw);
    };
    this._raf = requestAnimationFrame(draw);
  }

  _clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    const g = this.ctx.createRadialGradient(
      this.focusX, this.focusY, 0,
      this.focusX, this.focusY, 320
    );
    const a = 0.05 + this.energy * 0.12;
    g.addColorStop(0, `rgba(235,235,255,${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  _drawParticles() {
    const ctx = this.ctx;
    const fx = this.focusX;
    const fy = this.focusY;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx + (fx - p.x) * 0.02 * this.energy;
      p.y += p.vy + (fy - p.y) * 0.02 * this.energy;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.life -= p.decay * 0.03;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = Math.max(0, p.life) * (0.3 + this.energy * 0.7);
      const hue = Math.round(200 - this.energy * 120);
      ctx.fillStyle = `hsla(${hue}, 70%, 70%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + this.energy), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }
}
