import { Registry } from "./registry.js";

const ZONES = [
  { city: "New York", tz: "America/New_York", flag: "us" },
  { city: "London", tz: "Europe/London", flag: "gb" },
  { city: "Mumbai", tz: "Asia/Kolkata", flag: "in" },
  { city: "Tokyo", tz: "Asia/Tokyo", flag: "jp" },
  { city: "Sydney", tz: "Australia/Sydney", flag: "au" },
  { city: "Dubai", tz: "Asia/Dubai", flag: "ae" },
  { city: "Berlin", tz: "Europe/Berlin", flag: "de" },
  { city: "São Paulo", tz: "America/Sao_Paulo", flag: "br" },
];

const SVG_NS = "http://www.w3.org/2000/svg";

const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const circ = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const line = (x1, y1, x2, y2, stroke, width) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`;

function star(cx, cy, ro, ri, points, fill) {
  let pts = "";
  for (let i = 0; i < points; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / points;
    const ai = a + Math.PI / points;
    pts += `${(cx + Math.cos(a) * ro).toFixed(1)},${(cy + Math.sin(a) * ro).toFixed(1)} `;
    pts += `${(cx + Math.cos(ai) * ri).toFixed(1)},${(cy + Math.sin(ai) * ri).toFixed(1)} `;
  }
  return `<polygon points="${pts.trim()}" fill="${fill}"/>`;
}

const FLAGS = {
  us:
    rect(0, 0, 26, 18, "#FFFFFF") +
    rect(0, 0, 26, 2, "#B31942") +
    rect(0, 4, 26, 2, "#B31942") +
    rect(0, 8, 26, 2, "#B31942") +
    rect(0, 12, 26, 2, "#B31942") +
    rect(0, 16, 26, 2, "#B31942") +
    rect(0, 0, 11, 9, "#0A3161") +
    circ(2.2, 2.1, 0.85, "#FFFFFF") +
    circ(5.5, 2.1, 0.85, "#FFFFFF") +
    circ(8.8, 2.1, 0.85, "#FFFFFF") +
    circ(2.2, 5.4, 0.85, "#FFFFFF") +
    circ(5.5, 5.4, 0.85, "#FFFFFF") +
    circ(8.8, 5.4, 0.85, "#FFFFFF"),
  gb:
    rect(0, 0, 26, 18, "#012169") +
    rect(0, 7.4, 26, 3.2, "#FFFFFF") +
    rect(0, 8.3, 26, 1.4, "#C8102E") +
    rect(11.4, 0, 3.2, 18, "#FFFFFF") +
    rect(12.3, 0, 1.4, 18, "#C8102E") +
    line(0, 0, 26, 18, "#FFFFFF", 3.2) +
    line(26, 0, 0, 18, "#FFFFFF", 3.2) +
    line(0, 0, 26, 18, "#C8102E", 1.4) +
    line(26, 0, 0, 18, "#C8102E", 1.4),
  in:
    rect(0, 0, 26, 6, "#FF9933") +
    rect(0, 6, 26, 6, "#FFFFFF") +
    rect(0, 12, 26, 6, "#138808") +
    `<circle cx="13" cy="9" r="2.8" fill="none" stroke="#000080" stroke-width="1.1"/>` +
    circ(13, 9, 0.55, "#000080"),
  jp: rect(0, 0, 26, 18, "#FFFFFF") + circ(13, 9, 5.2, "#BC002D"),
  au:
    rect(0, 0, 26, 18, "#00247D") +
    rect(0, 0, 11, 9, "#012169") +
    rect(4.6, 0, 1.8, 9, "#FFFFFF") +
    rect(0, 3.6, 11, 1.8, "#FFFFFF") +
    rect(5, 0, 1, 9, "#C8102E") +
    rect(0, 4, 11, 1, "#C8102E") +
    line(0, 0, 11, 9, "#FFFFFF", 1.9) +
    line(11, 0, 0, 9, "#FFFFFF", 1.9) +
    line(0, 0, 11, 9, "#C8102E", 0.8) +
    line(11, 0, 0, 9, "#C8102E", 0.8) +
    star(4, 13.5, 1.9, 0.8, 7, "#FFFFFF") +
    star(17, 4.4, 1.5, 0.6, 5, "#FFFFFF") +
    star(20.2, 8, 1.2, 0.5, 5, "#FFFFFF") +
    star(16.8, 10.8, 1.2, 0.5, 5, "#FFFFFF") +
    star(21.4, 12.4, 1, 0.45, 5, "#FFFFFF"),
  ae:
    rect(0, 0, 7, 18, "#EF3340") +
    rect(7, 0, 19, 6, "#009E49") +
    rect(7, 6, 19, 6, "#FFFFFF") +
    rect(7, 12, 19, 6, "#000000"),
  de:
    rect(0, 0, 26, 6, "#000000") +
    rect(0, 6, 26, 6, "#DD0000") +
    rect(0, 12, 26, 6, "#FFCE00"),
  br:
    rect(0, 0, 26, 18, "#009739") +
    `<polygon points="13,1.6 24,9 13,16.4 2,9" fill="#FEDD00"/>` +
    circ(13, 9, 5.1, "#012169") +
    `<clipPath id="maya-flag-br-c"><circle cx="13" cy="9" r="5.1"/></clipPath>` +
    `<g clip-path="url(#maya-flag-br-c)"><rect x="8" y="10.7" width="10" height="1.7" fill="#FFFFFF"/></g>`,
};

function flagMarkup(key) {
  return (
    `<svg xmlns="${SVG_NS}" viewBox="0 0 26 18" aria-hidden="true">` +
    `<clipPath id="maya-flag-${key}"><rect width="26" height="18" rx="5"/></clipPath>` +
    `<g clip-path="url(#maya-flag-${key})">${FLAGS[key]}</g>` +
    `</svg>`
  );
}

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
  el.className = "maya-tool wc-tool is-live";

  const grid = document.createElement("div");
  grid.className = "wc-grid";

  ZONES.forEach(({ city, tz, flag }) => {
    const card = document.createElement("div");
    card.className = "wc-card";

    const flagEl = document.createElement("span");
    flagEl.className = "wc-flag";
    flagEl.innerHTML = flagMarkup(flag);

    const body = document.createElement("div");
    body.className = "wc-body";

    const area = document.createElement("div");
    area.className = "wc-area";

    const cityEl = document.createElement("span");
    cityEl.className = "wc-city";
    cityEl.textContent = city;
    area.appendChild(cityEl);

    const timeEl = document.createElement("span");
    timeEl.className = "wc-time";

    const offsetEl = document.createElement("span");
    offsetEl.className = "wc-offset";

    body.appendChild(area);
    body.appendChild(timeEl);

    card.appendChild(flagEl);
    card.appendChild(body);
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