import { Registry } from "./registry.js";

function parseDuration(params) {
  if (params.seconds != null) return Math.round(params.seconds);
  if (params.minutes != null) return Math.round(params.minutes * 60);
  if (params.duration != null) return Math.round(params.duration);
  if (params.alarm) {
    const m = String(params.alarm).match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const now = new Date();
      const target = new Date(now);
      target.setHours(+m[1], +m[2], 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      return Math.round((target - now) / 1000);
    }
  }
  return 0;
}

Registry.register({
  name: "timer",
  description: "Set, pause, resume, and cancel timers",
  match(text) {
    if (/timer|countdown|alarm/i.test(text)) {
      const mins = text.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|m\b)/i);
      const secs = text.match(/(\d+(?:\.\d+)?)\s*(?:sec|second|s\b)/i);
      if (/cancel|stop|clear/i.test(text)) {
        return { action: "cancel" };
      }
      if (/pause/i.test(text)) return { action: "pause" };
      if (/resume|continue/i.test(text)) return { action: "resume" };
      const params = {};
      if (mins) params.minutes = parseFloat(mins[1]);
      if (secs) params.seconds = parseFloat(secs[1]);
      return { action: "create", params };
    }
    return null;
  },
});

Registry.implement("timer", (params) => {
  const total = parseDuration(params) || 90;
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
        <div class="timer-digits">--:--</div>
      </div>
      <div class="timer-controls">
        <button class="maya-btn" data-act="toggle">Pause</button>
        <button class="maya-btn" data-act="cancel">Cancel</button>
      </div>
    </div>`;

  const digits = el.querySelector(".timer-digits");
  const progress = el.querySelector(".progress");
  const toggleBtn = el.querySelector('[data-act="toggle"]');
  const cancelBtn = el.querySelector('[data-act="cancel"]');

  let remaining = total;
  let running = true;
  let raf = 0;
  let last = performance.now();
  let tick = 0;

  function fmt(s) {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }

  function paint() {
    digits.textContent = fmt(Math.max(0, remaining));
    const frac = total > 0 ? remaining / total : 0;
    progress.style.strokeDashoffset = String(circ * (1 - frac));
  }

  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (running) {
      remaining -= dt;
      if (remaining <= 0) {
        remaining = 0;
        running = false;
        toggleBtn.textContent = "Done";
        complete();
      }
    }
    paint();
    tick = (tick + 1) % 2;
    raf = requestAnimationFrame(frame);
  }

  function complete() {
    el.classList.add("is-dissolving");
    el.dispatchEvent(new CustomEvent("maya:complete"));
    setTimeout(() => el.remove(), 600);
  }

  toggleBtn.addEventListener("click", () => {
    running = !running;
    toggleBtn.textContent = running ? "Pause" : "Resume";
  });

  cancelBtn.addEventListener("click", () => complete());

  // Replace the stage children and own the loop.
  el._maya = { destroy: () => cancelAnimationFrame(raf) };

  raf = requestAnimationFrame(frame);
  return el;
});
