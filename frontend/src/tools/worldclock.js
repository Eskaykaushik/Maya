import { Registry } from "./registry.js";

const ZONES = [
  { city: "New York", tz: "America/New_York" },
  { city: "London", tz: "Europe/London" },
  { city: "Mumbai", tz: "Asia/Kolkata" },
  { city: "Tokyo", tz: "Asia/Tokyo" },
  { city: "Sydney", tz: "Australia/Sydney" },
  { city: "Dubai", tz: "Asia/Dubai" },
  { city: "Berlin", tz: "Europe/Berlin" },
  { city: "São Paulo", tz: "America/Sao_Paulo" },
];

Registry.register({
  name: "worldclock",
  description: "Show live clocks for cities around the world",
  match(text) {
    if (/world\s*clock|timezone|time zones|what time.*(?:in|there)/i.test(text)) {
      return { action: "show" };
    }
    return null;
  },
});

Registry.implement("worldclock", () => {
  const el = document.createElement("div");
  el.className = "maya-tool is-live";

  const grid = document.createElement("div");
  grid.className = "wc-grid";

  ZONES.forEach(({ city, tz }) => {
    const card = document.createElement("div");
    card.className = "wc-card";

    const cityEl = document.createElement("div");
    cityEl.className = "wc-city";
    cityEl.textContent = city;

    const timeEl = document.createElement("div");
    timeEl.className = "wc-time";

    const offsetEl = document.createElement("div");
    offsetEl.className = "wc-offset";

    card.appendChild(cityEl);
    card.appendChild(timeEl);
    card.appendChild(offsetEl);
    grid.appendChild(card);

    function tick() {
      const now = new Date();
      const opts = { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false };
      timeEl.textContent = now.toLocaleTimeString("en-GB", opts);

      const offset = getOffset(now, tz);
      const sign = offset >= 0 ? "+" : "";
      offsetEl.textContent = `${sign}${offset.toFixed(1)}h`;
    }

    function getOffset(date, timeZone) {
      const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
      const local = new Date(date.toLocaleString("en-US", { timeZone }));
      return (local - utc) / 3600000;
    }

    tick();
    const id = setInterval(tick, 10000);
    el._intervals = el._intervals || [];
    el._intervals.push(id);
  });

  el.appendChild(grid);

  el._maya = {
    destroy: () => {
      if (el._intervals) el._intervals.forEach(clearInterval);
    },
  };
  return el;
});
