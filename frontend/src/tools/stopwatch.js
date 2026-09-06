import { Registry } from "./registry.js";

Registry.register({
  name: "stopwatch",
  description: "Start, pause, resume, and reset a stopwatch",
  match(text) {
    if (/stopwatch|lap|elapsed|timing/i.test(text)) {
      if (/cancel|stop|clear|reset/i.test(text)) return { action: "reset" };
      if (/pause|hold/i.test(text)) return { action: "pause" };
      if (/resume|continue/i.test(text)) return { action: "resume" };
      return { action: "start" };
    }
    return null;
  },
});

Registry.implement("stopwatch", () => {
  const radius = 80;
  const circ = 2 * Math.PI * radius;

  const el = document.createElement("div");
  el.className = "maya-tool is-live";
  el.innerHTML = `
    <div class="timer-face">
      <div class="timer-ring">
        <svg viewBox="0 0 176 176">
          <circle class="track" cx="88" cy="88" r="${radius}"></circle>
          <circle class="progress" cx="88" cy="88" r="${radius}"
                  stroke-dasharray="${circ}" stroke-dashoffset="0"></circle>
        </svg>
        <div class="timer-digits">00:00.0</div>
      </div>
      <div class="timer-controls">
        <button class="maya-btn" data-act="toggle">Pause</button>
        <button class="maya-btn" data-act="lap">Lap</button>
        <button class="maya-btn" data-act="cancel">Stop</button>
      </div>
    </div>`;

  const digits = el.querySelector(".timer-digits");
  const progress = el.querySelector(".progress");
  const toggleBtn = el.querySelector('[data-act="toggle"]');
  const lapBtn = el.querySelector('[data-act="lap"]');
  const cancelBtn = el.querySelector('[data-act="cancel"]');

  let elapsed = 0;
  let running = true;
  let last = performance.now();
  let raf = 0;
  let lapCount = 0;

  function fmt(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");
    const tenths = Math.floor((ms % 1000) / 100);
    return `${mins}:${secs}.${tenths}`;
  }

  function frame(now) {
    const dt = now - last;
    last = now;
    if (running) elapsed += dt;
    digits.textContent = fmt(elapsed);
    // Sweep: one full rotation per 60s.
    const frac = (elapsed % 60000) / 60000;
    progress.style.strokeDashoffset = String(circ * (1 - frac));
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    el.classList.add("is-dissolving");
    el.dispatchEvent(new CustomEvent("maya:complete"));
    setTimeout(() => el.remove(), 600);
  }

  toggleBtn.addEventListener("click", () => {
    running = !running;
    toggleBtn.textContent = running ? "Pause" : "Resume";
  });

  lapBtn.addEventListener("click", () => {
    lapCount++;
    digits.style.textShadow = "0 0 12px rgba(120,140,255,0.5)";
    setTimeout(() => { digits.style.textShadow = ""; }, 250);
  });

  cancelBtn.addEventListener("click", finish);

  el._maya = { destroy: () => cancelAnimationFrame(raf) };
  raf = requestAnimationFrame(frame);
  return el;
});
