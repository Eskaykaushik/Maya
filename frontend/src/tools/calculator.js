import { Registry } from "./registry.js";

function safeEval(expr) {
  try {
    const cleaned = expr.replace(/,/g, "").replace(/x/gi, "*");
    const result = Function(`"use strict"; return (${cleaned})`)();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function toSecondsExpression(text) {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*(?:hr|hour|hrs|hours)/gi, "($1*3600)")
    .replace(/(\d+(?:\.\d+)?)\s*(?:min|minute|mins|minutes)/gi, "($1*60)")
    .replace(/(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds)/gi, "($1)")
    .replace(/\bplus\b/gi, "+")
    .replace(/\bminus\b/gi, "-")
    .replace(/\btimes\b/gi, "*")
    .replace(/\bmultiplied by\b/gi, "*")
    .replace(/\bdivided by\b/gi, "/")
    .replace(/\bover\b/gi, "/")
    .replace(/\bdivided\s*by?\b/gi, "/")
    .replace(/\bpercent of\b/gi, "/100*")
    .replace(/\bpercent\b/gi, "/100")
    .replace(/\bhalf of\b/gi, "*0.5")
    .replace(/\bdouble\b/gi, "*2")
    .replace(/\bsquare\b/gi, "**2")
    .replace(/\bcubed\b/gi, "**3")
    .replace(/\bto the power of\b/gi, "**")
    .replace(/[^\d+\-*/().% ]/g, "");
}

Registry.register({
  name: "calculator",
  description: "Perform arithmetic",
  match(text) {
    const ops = /[+\-*/]|plus|minus|times|divided|over|percent|square|cubed|power|half of|double/i;
    const anyNumber = /\d/;
    if (ops.test(text) && anyNumber.test(text)) {
      const expr = toSecondsExpression(text);
      const result = safeEval(expr);
      if (result !== null) {
        return {
          action: "compute",
          params: { expression: expr, result },
        };
      }
    }
    return null;
  },
});

Registry.implement("calculator", (params) => {
  const initial = params?.result ?? params?.expression ?? "";
  const el = document.createElement("div");
  el.className = "maya-tool is-live";
  el.innerHTML = `
    <div class="calc">
      <div class="calc-display"></div>
      <div class="calc-grid">
        ${["7","8","9","/","4","5","6","*","1","2","3","-","0",".","C","+"].map(
          (k) => `<button class="calc-key ${"+*/".includes(k) ? "op" : ""}" data-k="${k}">${k}</button>`
        ).join("")}
        <button class="calc-key eq" data-k="=">=</button>
        <button class="calc-key" data-k="(">(</button>
        <button class="calc-key" data-k=")">)</button>
      </div>
    </div>`;

  const display = el.querySelector(".calc-display");
  let expr = String(initial).replace(/^[\d.\s]+$/, "") || "";
  let isResult = !!String(initial);

  function render() {
    display.textContent = expr || "0";
  }

  function press(key) {
    if (key === "C") {
      expr = "";
      isResult = false;
    } else if (key === "=") {
      const res = safeEval(expr);
      expr = res !== null ? String(res) : "—";
      isResult = true;
    } else {
      if (isResult && /[0-9]/.test(key)) { expr = ""; }
      expr += key;
      isResult = false;
    }
    render();
  }

  if (initial) {
    display.textContent = String(initial);
  }

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-k]");
    if (btn) press(btn.dataset.k);
  });

  render();
  el._maya = { destroy: () => {} };
  return el;
});
