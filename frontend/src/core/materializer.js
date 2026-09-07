/**
 * Materializer — makes intent become visible, and visible become nothing.
 *
 * Wraps the stage element where the generative screen lives. Every response
 * and interface is shown in one fixed place at the true centre of the dark.
 *
 * Change is a single orchestrated handoff — never a hard swap, never two
 * screens stacked on one another:
 *
 *   YIELD  — the outgoing screen diffuses and drifts away (soft, fast).
 *            Once it has fully left the slot, the incoming screen begins.
 *   RISE   — the incoming matter rises from just below the slot and unveils
 *            through dust to its calm position.
 *   SETTLE — the new screen locks in; its children stagger into a form.
 *
 * Because the outgoing screen is gone before the incoming one arrives, the
 * two are never co-visible in the same place — the hand-off reads as one
 * thing dissolving into another, not one thing sitting on top of another.
 */

// Timings (ms)
const YIELD_MS = 340;      // how long the outgoing screen lingers as it melts
const DISSOLVE_MS = 1250;  // full dissolve of the outgoing screen
const UNVEIL_MS = 1400;    // full unveil of the incoming screen

export class Materializer {
  constructor(stageEl) {
    this.stage = stageEl;
    this.current = null;
    this._destroyFn = null;
    this._transitioning = false;
  }

  get active() {
    return this.current !== null;
  }

  /** Sink the current screen gently, then finish its removal off-screen. */
  _yieldCurrent(prev, prevDestroy) {
    prev.classList.add("is-yielding");

    setTimeout(() => {
      if (prevDestroy) { try { prevDestroy(); } catch {} }
      if (prev.parentNode === this.stage) prev.remove();
      if (!this.stage.querySelector(".maya-tool")) {
        this.stage.classList.remove("has-tool");
      }
    }, DISSOLVE_MS);

    // The incoming screen's unveil must wait until the visitor has visibly
    // receded far enough to be beside, not on top of, it.
    return YIELD_MS;
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
   *
   * The hand-off is staged so the outgoing and incoming screens are never
   * co-visible: the visitor is yielded to a sinking dissolve, then the new
   * screen rises in beneath it. `crossfade:false` swaps instantly instead.
   */
  mount(el, opts = {}) {
    const prev = this.current;
    const prevDestroy = this._destroyFn;
    const crossfade = opts.crossfade !== false;

    let delay = 0;
    if (prev && crossfade) {
      delay = this._yieldCurrent(prev, prevDestroy);
    } else if (prev) {
      if (prevDestroy) { try { prevDestroy(); } catch {} }
      prev.remove();
    }

    // Hold the slot while the visitor clears, so a fresh mount never lands
    // on top of a screen that has not yet begun to leave.
    if (delay > 0) {
      this.current = null;
      this._destroyFn = null;
      if (this._transitioning) clearTimeout(this._transitioning);
      this._transitioning = setTimeout(() => {
        this._transitioning = null;
        this._mountNow(el, opts);
      }, delay);
      return el;
    }

    if (this._transitioning) {
      clearTimeout(this._transitioning);
      this._transitioning = null;
    }
    return this._mountNow(el, opts);
  }

  _mountNow(el, opts) {
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
    // Increment F — generated interfaces assemble from a directional particle
    // stream: children stagger in while the slot is marked is-assembling.
    // Legacy tools skip this (they keep their own entrance animation).
    if (el.querySelector(".ui-stack")) {
      el.classList.add("is-assembling");
      setTimeout(() => el.classList.remove("is-assembling"), 1400);
      el.dispatchEvent(new CustomEvent("maya:stream", { detail: { x: pos.cx, y: pos.cy } }));
    }
    return el;
  }

  /** Dissolve the current experience back into nothing. */
  dismiss(muted = false) {
    if (this._transitioning) {
      clearTimeout(this._transitioning);
      this._transitioning = null;
    }

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
    setTimeout(() => remove(), DISSOLVE_MS);
  }

  clearAll() {
    this.dismiss(true);
  }
}
