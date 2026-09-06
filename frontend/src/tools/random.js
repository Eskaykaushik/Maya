import { Registry } from "./registry.js";

Registry.register({
  name: "random",
  description: "Generate random numbers, coin flips, dice rolls, and pick from lists",
  match(text) {
    if (/random|dice|roll|coin|heads|tails|pick\s*(from|one)|choose\s*between|flip/i.test(text)) {
      return { action: "generate", params: { text } };
    }
    return null;
  },
});

Registry.implement("random", (params) => {
  const el = document.createElement("div");
  el.className = "maya-tool is-live";

  // Determine what to generate
  let result = "";
  let label = "";
  const text = (params && params.text) || "";

  if (/coin/i.test(text)) {
    result = Math.random() < 0.5 ? "Heads" : "Tails";
    label = "Coin Flip";
  } else if (/dice|roll/i.test(text)) {
    const n = 6;
    result = String(Math.floor(Math.random() * n) + 1);
    label = "Dice Roll";
  } else {
    // Random number 0-100 or custom range
    const rangeMatch = text.match(/(\d+)\s*(?:to|-)\s*(\d+)/);
    let min = 0, max = 100;
    if (rangeMatch) {
      min = parseInt(rangeMatch[1]);
      max = parseInt(rangeMatch[2]);
    }
    result = String(Math.floor(Math.random() * (max - min + 1)) + min);
    label = "Random Number";
  }

  el.innerHTML = `
    <div class="random-face">
      <div class="random-label">${label}</div>
      <div class="random-result">${result}</div>
      <div class="random-again">tap to regenerate</div>
    </div>`;

  const resultEl = el.querySelector(".random-result");

  function regenerate() {
    resultEl.style.animation = "none";
    void resultEl.offsetWidth;
    resultEl.style.animation = "";
    if (/coin/i.test(text)) {
      resultEl.textContent = Math.random() < 0.5 ? "Heads" : "Tails";
    } else if (/dice|roll/i.test(text)) {
      resultEl.textContent = String(Math.floor(Math.random() * 6) + 1);
    } else {
      const rangeMatch = text.match(/(\d+)\s*(?:to|-)\s*(\d+)/);
      let min = 0, max = 100;
      if (rangeMatch) {
        min = parseInt(rangeMatch[1]);
        max = parseInt(rangeMatch[2]);
      }
      resultEl.textContent = String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
  }

  el.addEventListener("click", regenerate);

  el._maya = { destroy: () => {} };
  return el;
});
