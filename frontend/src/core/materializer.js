/**
 * Materializer — makes intent become visible, and visible become nothing.
 *
 * Wraps the stage element where the generative screen lives. Every response
 * and interface is shown within a fixed canvas — a reserved centre region
 * where the eye expects action. The background chat thread recedes fully
 * behind it while the tool owns the stage.
 *
 * Change is a single orchestrated handoff — never a hard swap, never two
 * screens stacked on one another:
 *
 *   YIELD  — the outgoing screen diffuses and drifts away (soft, fast).
 *            Once it has fully left the slot, the incoming screen begins.
 *   RISE   — the incoming matter rises from just below the slot and unveils
 *            through dust to its calm position.
 *   SETTLE — the new screen locks in; its children stagger into a form.
 */

// Timings (ms)
const YIELD_MS = 340;
const DISSOLVE_MS = 1250;

export class Materializer {
  constructor(stageEl) {
    this.stage = stageEl;
    this.current = null;
    this._destroyFn = null;
    this._transitioning = false;
    this._onToolActive = null;
    this._onToolInactive = null;
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
        if (this._onToolInactive) this._onToolInactive();
      }
    }, DISSOLVE_MS);

    return YIELD_MS;
  }

  /** Read the fixed canvas-slot bounds so we clamp tools within it. */
  _canvasBounds() {
    const slot = document.getElementById("maya-canvas-slot");
    if (!slot) return null;
    const r = slot.getBoundingClientRect();
    if (!r || r.width <= 0) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  /**
   * The generative screen — tools land within the fixed canvas-slot.
   * The sacred zones (anchor top, composer bottom) clamp vertically;
   * the canvas-slot bounds clamp horizontally.
   */
  computeSlot(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = (rect && rect.width) || 0;
    const h = (rect && rect.height) || 0;
    const cb = this._canvasBounds();

    // Vertical — composer + footer band below, anchor dot above.
    const safeTop = Math.max(44, this._topAnchor(vh));
    const safeBottom = vh - Math.max(48, this._bottomBand(vh)) - 8;
    const cy = (safeTop + safeBottom) / 2;

    let y = Math.round(cy - h / 2);
    if (y < safeTop) y = safeTop;
    if (y + h > safeBottom) y = Math.max(safeTop, safeBottom - h);

    // Horizontal — centre within the canvas-slot, clamped so nothing
    // spills outside its hairline.
    let x;
    if (cb) {
      const slotCx = cb.cx;
      x = Math.round(slotCx - w / 2);
      x = Math.max(Math.round(cb.left), Math.min(x, Math.round(cb.left + cb.width - w)));
    } else {
      x = Math.round(vw / 2 - w / 2);
    }
    x = Math.max(this._anchorClearance(), x);

    return { x, y, cx: Math.round(x + w / 2), cy: Math.round(y + h / 2) };
  }

  /** How tall the sacred bottom band is — composer + footer. */
  _bottomBand(vh) {
    let band = 0;
    for (const sel of ["#maya-input", ".site-footer"]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (!rect || rect.height <= 0) continue;
      band = Math.max(band, vh - Math.max(0, rect.top));
    }
    return Math.max(48, Math.min(Math.max(band, 48), vh * 0.5));
  }

  /** Top sacred zone — clear the anchor dot and the prompt height. */
  _topAnchor(vh) {
    const btn = document.querySelector(".chat-collapse");
    if (!btn || btn.hidden) return 44;
    const r = btn.getBoundingClientRect();
    return (r && r.height > 0 ? r.bottom : 32) + 16;
  }

  /** Left clearance so nothing covers the anchor dot. */
  _anchorClearance() {
    const btn = document.querySelector(".chat-collapse");
    if (!btn || btn.hidden) return 44;
    const rect = btn.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 44;
    return rect.right + 10;
  }

  /**
   * Mount a rendered experience on the stage within the canvas-slot.
   * The hand-off is staged: outgoing yields, then incoming rises.
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

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "tool-close";
    closeBtn.setAttribute("aria-label", "Close interface");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      el.dispatchEvent(new CustomEvent("maya:close"));
    });
    el.appendChild(closeBtn);

    // Mark the canvas-slot as active (subtle glow).
    const slot = document.getElementById("maya-canvas-slot");
    if (slot) slot.classList.add("has-tool");

    // Notify the chat to dim while a tool is live.
    if (this._onToolActive) this._onToolActive();

    const w = el.offsetWidth || 0;
    const h = el.offsetHeight || 0;
    const pos = this.computeSlot({ width: w, height: h });
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;

    el.dispatchEvent(new CustomEvent("maya:landed", { detail: { x: pos.cx, y: pos.cy } }));

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
        const slot = document.getElementById("maya-canvas-slot");
        if (slot) slot.classList.remove("has-tool");
        if (this._onToolInactive) this._onToolInactive();
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
