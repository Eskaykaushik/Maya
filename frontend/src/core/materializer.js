/**
 * Materializer — makes intent become visible, and visible become nothing.
 *
 * Wraps the stage element where the generative screen lives. Every response
 * and interface is shown in one fixed place at the true centre of the dark,
 * and changes into the next screen slowly — the outgoing screen diffuses
 * while the incoming one unveils in place.
 */

export class Materializer {
  constructor(stageEl) {
    this.stage = stageEl;
    this.current = null;
    this._destroyFn = null;
  }

  get active() {
    return this.current !== null;
  }

  /**
   * The generative screen — one fixed place, the true centre of the dark.
   * Left/top are the tool's top-left, so its centre lands mid-screen. The
   * sacred zones still clamp it: the top-left anchor dot above and the
   * composer + footer band below.
   */
  computeSlot(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = (rect && rect.width) || 0;
    const h = (rect && rect.height) || 0;

    const cy = vh / 2;
    const safeBottom = vh - Math.max(48, this._bottomBand(vh)) - 8;

    const x = Math.max(this._anchorClearance(), Math.round(vw / 2 - w / 2));
    // Clamp vertically to the band above the composer + footer; a screen
    // taller than the space rides upward rather than spilling into it.
    let y = Math.round(cy - h / 2);
    if (y + h > safeBottom) y = Math.max(0, safeBottom - h);

    const pos = {
      x: Math.round(x),
      y: Math.round(y),
      cx: Math.round(vw / 2),
      cy: Math.round(y + h / 2),
    };
    return pos;
  }

  /** How tall the sacred bottom band is — point of the composer, then footer. */
  _bottomBand(vh) {
    let band = 0;
    for (const sel of ["#maya-input", ".site-footer"]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (!rect || rect.height <= 0) continue;
      band = Math.max(band, vh - Math.max(0, rect.top));
    }
    // Never let the band swallow the whole stage.
    return Math.max(48, Math.min(Math.max(band, 48), vh * 0.5));
  }

  /** Left clearance so nothing ever covers the top-left anchor dot. */
  _anchorClearance() {
    const btn = document.querySelector(".chat-collapse");
    if (!btn || btn.hidden) return 44;
    const rect = btn.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 44;
    return rect.right + 10;
  }

  /**
   * Mount a rendered experience on the stage at the generative screen.
   * With `crossfade`, the previous screen is left to diffuse out slowly
   * while the new one unveils in the same slot.
   */
  mount(el, opts = {}) {
    const prev = this.current;
    const prevDestroy = this._destroyFn;

    if (prev) {
      if (opts.crossfade !== false) {
        const doomed = prev;
        doomed.classList.add("is-dissolving");
        setTimeout(() => {
          if (doomed.parentNode === this.stage) doomed.remove();
          if (!this.stage.querySelector(".maya-tool")) {
            this.stage.classList.remove("has-tool");
          }
        }, 1250);
      } else {
        if (prevDestroy) { try { prevDestroy(); } catch {} }
        prev.remove();
      }
    }

    this.current = el;
    this._destroyFn = el?._maya?.destroy || null;
    this.stage.appendChild(el);
    this.stage.classList.add("has-tool");

    // Measure after insertion. offsetWidth/offsetHeight are layout metrics,
    // unaffected by the emergence animation's scale transform.
    const w = el.offsetWidth || 0;
    const h = el.offsetHeight || 0;
    const pos = this.computeSlot({ width: w, height: h });
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;

    // Tell the world where the screen is so particles converge there.
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
    setTimeout(() => remove(), 1250);
  }

  clearAll() {
    this.dismiss(true);
  }
}