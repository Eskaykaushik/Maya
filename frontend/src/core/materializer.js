/**
 * Materializer — makes intent become visible, and visible become nothing.
 *
 * Wraps the stage element where tool experiences live. Every tool the
 * registry creates is mounted here, emerges from a *fresh, unpredictable
 * point in the dark*, lives, and on request dissolves back into nothing.
 */

export class Materializer {
  constructor(stageEl) {
    this.stage = stageEl;
    this.current = null;
    this._destroyFn = null;
    // Remembers the previous landing spot so the next one tends to be elsewhere.
    this._last = null;
  }

  get active() {
    return this.current !== null;
  }

  /**
   * Pick a pseudo-random landing position for a tool of the given size
   * (width/height), constrained to the configured safe region. Avoids the
   * previous spot and keeps the tool fully inside the viewport.
   */
  pickPosition(rect) {
    const cfg = (window.MAYA && window.MAYA.placement) || {};
    const xMin = (cfg.xMin ?? 0.16) * window.innerWidth;
    const xMax = (cfg.xMax ?? 0.84) * window.innerWidth;
    const yMin = (cfg.yMin ?? 0.14) * window.innerHeight;
    const yMax = (cfg.yMax ?? 0.86) * window.innerHeight;

    const w = (rect && rect.width) || 0;
    const h = (rect && rect.height) || 0;

    // Clamp the allowed region so the tool's bounding box stays visible.
    const rxMin = Math.min(xMin, Math.max(0, xMax - w));
    const rxMax = Math.max(rxMin + 1, xMax - w);
    const ryMin = Math.min(yMin, Math.max(0, yMax - h));
    const ryMax = Math.max(ryMin + 1, yMax - h);

    let x = rxMin + Math.random() * (rxMax - rxMin);
    let y = ryMin + Math.random() * (ryMax - ryMin);

    // Gently discourage stacking on the previous spot.
    if (this._last) {
      const away = this._last;
      const dx = (rxMax - rxMin) / 2;
      const dy = (ryMax - ryMin) / 2;
      const cx = rxMin + Math.random() * (rxMax - rxMin);
      const cy = ryMin + Math.random() * (ryMax - ryMin);
      // With some probability, push away from the last position's half.
      if (Math.abs(away.x - x) < dx * 0.5 && Math.random() < 0.7) {
        x = cx < away.x ? rxMin + dx*0.2 : rxMax - dx*0.2;
      }
      if (Math.abs(away.y - y) < dy * 0.5 && Math.random() < 0.7) {
        y = cy < away.y ? ryMin + dy*0.2 : ryMax - dy*0.2;
      }
    }

    // The anchor is the tool's top-left; we want its center at (x, y).
    const pos = {
      x: Math.round(x),
      y: Math.round(y),
      cx: Math.round(x + w / 2),
      cy: Math.round(y + h / 2),
    };
    this._last = { x: pos.cx, y: pos.cy };
    return pos;
  }

  /**
   * Mount a rendered experience on the stage at an unpredictable position.
   */
  mount(el) {
    this.dismiss(true);
    this.current = el;
    this.stage.appendChild(el);
    this.stage.classList.add("has-tool");

    // Measure after insertion. offsetWidth/offsetHeight are layout metrics,
    // unaffected by the emergence animation's scale transform.
    const w = el.offsetWidth || 0;
    const h = el.offsetHeight || 0;
    const pos = this.pickPosition({ width: w, height: h });
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;

    this._destroyFn = el?._maya?.destroy || null;

    // Tell the world where it landed so particles can converge there.
    el.dispatchEvent(new CustomEvent("maya:landed", { detail: { x: pos.cx, y: pos.cy } }));
    return el;
  }

  /** Dissolve the current experience back into nothing. */
  dismiss(muted = false) {
    if (!this.current) return;
    const el = this.current;
    const destroyFn = this._destroyFn;
    this.current = null;
    this._destroyFn = null;

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      if (destroyFn) { try { destroyFn(); } catch {} }
      if (el && el.parentNode === this.stage) el.remove();
      if (!this.stage.querySelector(".maya-tool")) {
        this.stage.classList.remove("has-tool");
      }
    };

    if (muted) {
      remove();
      return;
    }

    el.classList.add("is-dissolving");
    setTimeout(() => remove(), 600);
  }

  clearAll() {
    this.dismiss(true);
  }
}