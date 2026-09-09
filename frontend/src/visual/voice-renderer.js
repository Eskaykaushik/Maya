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
    this.light = false;
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

  /** Adapt the particle palette to the current interface theme. */
  setLight(light) {
    this.light = !!light;
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
      : 0;
    this.targetEnergy = target;

    if (!this.feedIsRunning) {
      this.feedIsRunning = true;
      requestAnimationFrame(() => { this._syncParticles(target); this.feedIsRunning = false; });
    }
  }

  /** An instant sparkle of light at a point — a new surface announcing itself. */
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

  /** Chooses a screen edge to launch the assembly stream from. */
  _streamSource(tx, ty) {
    const r = Math.random();
    // axis = coordinate fixed to the edge wall; `at` = horizontal/vertical
    // midpoint to cluster the band around.
    if (r < 0.25) return { axis: "x", value: 0, at: tx };        // top
    if (r < 0.5)  return { axis: "x", value: this.h, at: tx };   // bottom
    if (r < 0.75) return { axis: "y", value: 0, at: ty };        // left
    return         { axis: "y", value: this.w, at: ty };         // right
  }

  /**
   * A directional assembly stream: `count` particles are emitted from a
   * screen edge and SETTLE into a soft disc around `(tx, ty)` — the centre
   * of what is being assembled. Each particle is goal-directed: it eases in,
   * flashes, and melts in place, so the eye reads "dust gathered to form
   * a form" instead of a random sparkle flyby.
   */
  stream(tx, ty, count = 70) {
    const s = this._streamSource(tx, ty);
    this.setFocus(tx, ty);
    for (let i = 0; i < count; i++) {
      // Cluster the band around the edge midpoint so the stream reads as a
      // solid ray rather than a full-height wall.
      const f = (Math.random() - 0.5) * Math.min(this.w, this.h) * 1.05;
      const sx = s.axis === "y" ? s.value : s.at + f;
      const sy = s.axis === "x" ? s.value : s.at + f;
      // Goal: a particle of the form it is building.
      const ga = Math.random() * Math.PI * 2;
      const gd = 6 + Math.random() * 54;
      this.particles.push({
        x: sx,
        y: sy,
        gx: tx + Math.cos(ga) * gd,
        gy: ty + Math.sin(ga) * gd,
        vx: 0,
        vy: 0,
        life: 1,
        decay: 0.32 + Math.random() * 0.18,
        size: 0.6 + Math.random() * 1.6,
        boost: 1,
        flashFrames: 0,
        arrJit: Math.random(),
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
    g.addColorStop(0, this.light ? `rgba(60, 95, 220, ${a})` : `rgba(235,235,255,${a})`);
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

      if (p.gx !== undefined) {
        // Assembly particles are goal-directed: ease into their spot, then
        // flash and melt in place — dust gathering into a form.
        const dx = p.gx - p.x;
        const dy = p.gy - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 2) {
          const step = 0.075 + p.arrJit * 0.04; // per-particle arrival jitter
          p.x += dx * step;
          p.y += dy * step;
        } else {
          p.x = p.gx;
          p.y = p.gy;
          p.flashFrames = 4;
          p.life -= 0.028;   // melt/gather in place
          p.size *= 0.92;
        }
      } else {
        p.x += p.vx + (fx - p.x) * 0.02 * this.energy;
        p.y += p.vy + (fy - p.y) * 0.02 * this.energy;
        p.vx *= 0.99;
        p.vy *= 0.99;
      }

      if (p.flashFrames > 0) p.flashFrames--;
      p.life -= p.decay * 0.03;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const flashing = p.flashFrames > 0;
      // Flash on arrival so assembling particles "click" into place.
      const alpha = Math.max(0, p.life) * Math.min(1, 0.36 + this.energy * 0.6 + 0.58 * (p.boost || 0)) * (flashing ? 1.4 : 1);
      const hue = Math.round(200 - this.energy * 120 - 18 * (p.boost || 0));
      const light = this.light ? 32 : 72;
      ctx.fillStyle = `hsla(${hue}, 68%, ${light}%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + this.energy) * (p.boost ? 1.15 : 1) * (flashing ? 1.45 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }
}
