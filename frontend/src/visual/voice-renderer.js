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
    this.t = 0;
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
      : (this.state === "listening" || this.state === "voice") ? Math.min(0.45, amplitude * 9)
      : this.state === "thinking" ? this.energy * 0.3
      : this.state === "prompting" ? 0.16
      : 0;
    this.targetEnergy = target;

    if (!this.feedIsRunning) {
      this.feedIsRunning = true;
      requestAnimationFrame(() => { this._syncParticles(target); this.feedIsRunning = false; });
    }
  }

  /** An instant sparkle of light at a point — the chooser announcing itself. */
  burst(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 24 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * d * 0.16,
        vy: Math.sin(a) * d * 0.16 - 0.4,
        life: 1,
        decay: 0.5 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.7,
      });
      if (this.particles.length > 1200) this.particles.length = 1200;
    }
  }

  /** Rotates among cardinal directions so the stream doesn't always
    come from the same side. */
  _streamSource(tx, ty) {
    const edges = [
      { x: tx, y: 0 },        // top
      { x: 0, y: ty },        // left
      { x: tx, y: this.h },   // bottom
      { x: this.w, y: ty },   // right
    ];
    const e = edges[Math.floor(Math.random() * edges.length)];
    // Jitter the point spread slightly so each burst feels organic.
    e.x += (Math.random() - 0.5) * this.w * 0.14;
    e.y += (Math.random() - 0.5) * this.h * 0.14;
    return e;
  }

  /**
   * A directional assembly stream: `count` particles are emitted from a
   * screen edge and travel toward `(tx, ty)` — the centre of what is being
   * assembled. They settle into the focus the way dust gathers to form a
   * form, rather than just dissolving out of a point.
   */
  stream(tx, ty, count = 90) {
    const src = this._streamSource(this.focusX, this.focusY);
    this.setFocus(tx, ty);
    for (let i = 0; i < count; i++) {
      // Random along the source edge so the burst is a band, not a point.
      const sx = typeof src.x === "number" && Math.abs(src.x - tx) < 4 ? (Math.random() * this.w) : src.x;
      const sy = typeof src.y === "number" && Math.abs(src.y - ty) < 4 ? (Math.random() * this.h) : src.y;
      const dist = Math.hypot(tx - sx, ty - sy);
      const ang = Math.atan2(ty - sy, tx - sx);
      const spread = (Math.random() - 0.5) * 0.5;
      const speed = (0.9 + Math.random() * 0.7) * (dist / 900 + 0.6);
      this.particles.push({
        x: sx,
        y: sy,
        vx: Math.cos(ang + spread) * speed * 3.2,
        vy: Math.sin(ang + spread) * speed * 3.2,
        life: 1,
        decay: 0.22 + Math.random() * 0.28,
        size: 0.8 + Math.random() * 1.9,
      });
      if (this.particles.length > 1200) this.particles.length = 1200;
    }
  }

  /**
   * A slow breath of particles for a screen change: energy eases up to
   * `level` and back to calm over `ms`, so the particles converge on the
   * focus (the generative screen) while its content unveils.
   */
  surge(level, ms = 1500) {
    if (this._surgeTimer) cancelAnimationFrame(this._surgeTimer);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = p * p * (3 - 2 * p); // smoothstep — 0 → level → 0
      this.targetEnergy = level * eased;
      if (p < 1) this._surgeTimer = requestAnimationFrame(step);
      else {
        this.targetEnergy = 0;
        this._surgeTimer = 0;
      }
    };
    this._surgeTimer = requestAnimationFrame(step);
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
      this.t++;
      // Without a mic (privacy-first), the chooser still holds a living halo.
      if (this.state === "prompting") {
        this.targetEnergy = 0.16 + Math.sin(this.t * 0.012) * 0.05;
        this._syncParticles(this.targetEnergy);
      }
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
