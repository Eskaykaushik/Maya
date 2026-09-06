/* Ghost primitives — the only visual vocabulary generated interfaces may use.
 * Clean, less, aesthetic: hairline borders, near-black fills, muted text,
 * one accent light per focal artifact. Styling lives in maya.css; these
 * functions only build structure and wire value/change behaviour. */

const make = (tag, className) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
};

const label = (text) => {
  const l = make("p", "ui-label");
  l.textContent = text || "";
  return l;
};

export function renderPrimitive(spec, ctx = {}) {
  const dispatch = ctx.dispatch || (() => {});
  switch (spec.type) {
    case "text": return renderText(spec);
    case "button": return renderButton(spec, dispatch);
    case "input": return renderInput(spec);
    case "select": return renderSelect(spec);
    case "slider": return renderSlider(spec, dispatch);
    case "toggle": return renderToggle(spec, dispatch);
    case "file": return renderFile(spec, ctx.sources || {}, dispatch);
    case "metric": return renderMetric(spec);
    default: return null;
  }
}

function renderText(spec) {
  const wrap = make("div", "ghost-block");
  if (spec.label) wrap.appendChild(label(spec.label));
  const el = make("p", "ghost-text");
  el.textContent = spec.text || spec.label || "";
  wrap.appendChild(el);
  return { el: wrap, getValue: () => el.textContent, setValue: (v) => { el.textContent = v == null ? "" : String(v); } };
}

function renderButton(spec, dispatch) {
  const wrap = make("div", "ghost-block");
  const btn = make("button", "maya-btn ghost-btn");
  btn.type = "button";
  btn.textContent = spec.label || "Go";
  wrap.appendChild(btn);
  btn.addEventListener("click", () => dispatch("ui:action", { id: spec.id, type: "click", label: btn.textContent }));
  return { el: wrap, getValue: () => null, setValue: () => {} };
}

function renderInput(spec) {
  const wrap = make("div", "ghost-block");
  if (spec.label) wrap.appendChild(label(spec.label));
  const inp = make("input", "ghost-field ghost-input");
  inp.type = spec.kind || "text";
  inp.placeholder = spec.placeholder || "";
  inp.value = spec.value != null ? String(spec.value) : "";
  wrap.appendChild(inp);
  return { el: wrap, getValue: () => inp.value, setValue: (v) => { inp.value = v == null ? "" : String(v); } };
}

function renderSelect(spec) {
  const wrap = make("div", "ghost-block");
  if (spec.label) wrap.appendChild(label(spec.label));
  const sel = make("select", "ghost-field ghost-select");
  (spec.options || []).forEach((opt) => {
    const o = make("option");
    if (typeof opt === "string") {
      o.value = opt;
      o.textContent = opt;
    } else {
      o.value = opt.value ?? opt.label;
      o.textContent = opt.label;
    }
    sel.appendChild(o);
  });
  wrap.appendChild(sel);
  return { el: wrap, getValue: () => sel.value, setValue: (v) => { sel.value = String(v); } };
}

function renderSlider(spec, dispatch) {
  const wrap = make("div", "ghost-block");
  if (spec.label) wrap.appendChild(label(spec.label));
  const row = make("div", "ghost-slider-row");
  const range = make("input", "ghost-field ghost-range");
  range.type = "range";
  range.min = spec.min ?? 0;
  range.max = spec.max ?? 100;
  range.step = spec.step ?? 1;
  range.value = spec.value != null ? spec.value : range.min;
  const readout = make("span", "ghost-value");
  readout.textContent = range.value;
  range.addEventListener("input", () => {
    readout.textContent = range.value;
    dispatch("ui:change", { id: spec.id, type: "range", value: Number(range.value) });
  });
  row.append(range, readout);
  wrap.appendChild(row);
  return { el: wrap, getValue: () => Number(range.value), setValue: (v) => { range.value = v; readout.textContent = v; } };
}

function renderToggle(spec, dispatch) {
  const wrap = make("div", "ghost-block ghost-toggle-row");
  const toggle = make("button", "ghost-toggle");
  toggle.type = "button";
  toggle.setAttribute("role", "switch");
  const on = !!spec.on;
  toggle.classList.toggle("is-on", on);
  toggle.setAttribute("aria-checked", String(on));
  const name = make("span", "ghost-toggle-label");
  name.textContent = spec.label || "";
  toggle.addEventListener("click", () => {
    const now = toggle.classList.toggle("is-on");
    toggle.setAttribute("aria-checked", String(now));
    dispatch("ui:change", { id: spec.id, type: "toggle", value: now });
  });
  wrap.append(toggle, name);
  return {
    el: wrap,
    getValue: () => toggle.classList.contains("is-on"),
    setValue: (v) => {
      toggle.classList.toggle("is-on", !!v);
      toggle.setAttribute("aria-checked", String(!!v));
    },
  };
}

function renderMetric(spec) {
  const wrap = make("div", "ghost-block");
  if (spec.label) wrap.appendChild(label(spec.label));
  const metric = make("div", "ghost-metric");
  metric.textContent = spec.value != null ? String(spec.value) : "—";
  wrap.appendChild(metric);
  return { el: wrap, getValue: () => metric.textContent, setValue: (v) => { metric.textContent = v == null ? "—" : String(v); } };
}

function renderFile(spec, sources, dispatch) {
  const wrap = make("div", "ghost-block");
  if (spec.label) wrap.appendChild(label(spec.label));
  const zone = make("button", "ghost-field ui-file");
  zone.type = "button";
  const nameEl = make("span", "ui-file-name");
  const statusEl = make("span", "ui-file-status");
  const picker = make("input");
  picker.type = "file";
  picker.accept = (spec.accept || []).join(",") || "*";
  picker.hidden = true;
  zone.append(nameEl, statusEl, picker);
  wrap.appendChild(zone);

  let current = null;
  const setFile = (name, text) => {
    current = name != null && text != null ? { name, text } : null;
    nameEl.textContent = name || spec.placeholder || "choose a file";
    statusEl.textContent = text != null ? "loaded" : "";
    zone.classList.toggle("is-ready", text != null);
  };

  const pre = sources && sources[spec.id];
  setFile(pre && pre.name != null ? pre.name : null, pre && pre.text != null ? pre.text : null);

  zone.addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    const f = picker.files && picker.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setFile(f.name, text);
      dispatch("ui:change", { id: spec.id, type: "file", value: { name: f.name, text } });
    };
    reader.readAsText(f);
  });

  return {
    el: wrap,
    getValue: () => (current && current.text != null ? current : null),
    setValue: (v) => setFile(v && v.name != null ? v.name : null, v && v.text != null ? v.text : null),
  };
}