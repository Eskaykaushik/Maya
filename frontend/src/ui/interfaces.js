/* interfaces — turns a validated UI spec into a live ghost interface.
 * Returns a handle over the mounted element: getValue/setValue per slot,
 * subscribe/dispatch for the event vocabulary, and it actually runs the
 * first diff primitive when a button is pressed. */

import { validate } from "./spec.js";
import { renderPrimitive } from "./primitives.js";
import { diffLines, diffStats } from "./domain/diff.js";

const MAX_RENDERED_LINES = 250;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function render(spec, opts = {}) {
  const verdict = validate(spec);
  if (!verdict.ok) {
    const el = document.createElement("div");
    el.className = "maya-tool is-error";
    const title = document.createElement("p");
    title.className = "ui-title";
    title.textContent = "spec rejected";
    const detail = document.createElement("p");
    detail.className = "ui-error";
    detail.textContent = verdict.errors.join(" · ");
    el.append(title, detail);
    return { ok: false, errors: verdict.errors, el };
  }

  const listeners = [];
  const dispatch = (name, detail = {}) => listeners.forEach((fn) => fn(name, detail));

  const el = document.createElement("div");
  el.className = "maya-tool ui-interface";
  const stack = document.createElement("div");
  stack.className = "ui-stack";
  el.appendChild(stack);

  const slots = new Map();
  const diffSpecs = [];

  for (const c of spec.components) {
    if (c.type === "diff") {
      diffSpecs.push(c);
    } else {
      const p = renderPrimitive(c, { dispatch, sources: opts.sources || {} });
      if (p) {
        slots.set(c.id, p);
        stack.appendChild(p.el);
      }
    }
  }

  for (const c of diffSpecs) {
    const d = renderDiffComponent(c, slots);
    slots.set(c.id, d);
    stack.appendChild(d.el);
    el.classList.add("has-diff");
  }

  wireActions(spec.components, slots, diffSpecs);

  return {
    ok: true,
    el,
    slots,
    getValue: (id) => {
      const s = slots.get(id);
      return s ? s.getValue() : undefined;
    },
    setValue: (id, v) => {
      const s = slots.get(id);
      if (s) s.setValue(v);
    },
    subscribe: (fn) => {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    dispatch,
  };
}

function renderDiffComponent(spec, slots) {
  const el = document.createElement("div");
  el.className = "ui-diff is-focal";
  const summary = document.createElement("p");
  summary.className = "ui-diff-summary";
  const lines = document.createElement("ol");
  lines.className = "ui-diff-lines";
  el.append(summary, lines);

  const emptyText = "not yet read — compare to reveal the difference";

  el._apply = (result) => {
    summary.textContent = result
      ? `${result.stats.removed} removed · ${result.stats.added} added`
      : emptyText;
    lines.textContent = "";
    const total = result ? result.items.length : 0;
    if (result) {
      result.items.forEach((item, i) => {
        if (i >= MAX_RENDERED_LINES) return;
        const row = document.createElement("li");
        row.className = `ui-line is-${item.type}`;
        const mark = document.createElement("span");
        mark.className = "ui-mark";
        mark.textContent = item.type === "del" ? "−" : item.type === "ins" ? "+" : "·";
        const text = document.createElement("span");
        text.className = "ui-line-text";
        text.textContent = item.line || " ";
        row.append(mark, text);
        lines.appendChild(row);
      });
      if (total > MAX_RENDERED_LINES) {
        const more = document.createElement("li");
        more.className = "ui-line ui-more";
        more.textContent = `… ${total - MAX_RENDERED_LINES} more lines`;
        lines.appendChild(more);
      }
    }
  };

  el._run = () => {
    const a = readSource(spec, "sourceA", slots);
    const b = readSource(spec, "sourceB", slots);
    if (a == null || b == null) {
      summary.textContent = "both sources need content to compare";
      el._last = null;
      return null;
    }
    const result = { items: diffLines(a, b), stats: diffStats(a, b) };
    el._last = result;
    el._apply(result);
    return { ok: true };
  };

  el._apply(null);
  return { el, getValue: () => el._last || null, setValue: () => {}, run: () => el._run() };
}

function readSource(spec, prop, slots) {
  const id = typeof spec[prop] === "string" ? spec[prop] : null;
  if (!id) return null;
  const slot = slots.get(id);
  if (!slot) return null;
  const value = slot.getValue();
  if (value == null) return null;
  return typeof value === "string" ? value : value.text ?? null;
}

function wireActions(components, slots, diffSpecs) {
  if (!diffSpecs.length) return;
  for (const c of components) {
    if (c.type !== "button") continue;
    const slot = slots.get(c.id);
    if (!slot || !slot.el) continue;
    const btn = slot.el.querySelector(".ghost-btn");
    if (btn) btn.addEventListener("click", () => {
      for (const d of diffSpecs) {
        const slotD = slots.get(d.id);
        if (slotD && slotD.run) slotD.run();
      }
    });
  }
}