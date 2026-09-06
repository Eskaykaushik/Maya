import { Registry } from "./registry.js";

const EXT_MAP = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  html: "text/html",
  svg: "image/svg+xml",
  js: "text/javascript",
  py: "text/x-python",
  css: "text/css",
};

function sanitizeName(name) {
  return (name || "untitled")
    .replace(/[^a-zA-Z0-9_\-.\s]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 64);
}

Registry.register({
  name: "filemaker",
  description: "Generate and download files — text, CSV, JSON, HTML, SVG, code",
  match(text) {
    const hasFileIntent = /(create|make|build|write|generate|save|download|export|capture).*?(file|document|note)|\b(csv|json|html|svg|md|txt)\s+file|download|export\b/i.test(text);
    const hasDataWord = /\b(csv|json|markdown|text|html|svg|document|file|sheet)\b/i.test(text);
    if (hasFileIntent || (hasDataWord && /request|want|need|write|make|create|save|download|export/i.test(text))) {
      const directExt = text.match(/\.(txt|md|json|csv|html|svg|js|py|css)\b/i);
      const wordExt = text.match(/\b(csv|json|html|svg|md|txt)\b/i);
      const ext = (directExt ? directExt[1] : wordExt ? wordExt[1] : "txt").toLowerCase();
      return { action: "create", params: { extension: ext } };
    }
    return null;
  },
});

Registry.implement("filemaker", (params) => {
  const ext = (params && params.extension) || "txt";
  const mime = EXT_MAP[ext] || "text/plain";
  const filename = `maya-output.${ext}`;

  // Build sample content based on extension
  let content = "";
  switch (ext) {
    case "json":
      content = JSON.stringify({ created: new Date().toISOString(), source: "Maya" }, null, 2);
      break;
    case "csv":
      content = "Name,Value\nSample,1\nExample,2\n";
      break;
    case "html":
      content = `<!DOCTYPE html>\n<html><head><title>Maya</title></head><body><h1>Hello from Maya</h1></body></html>`;
      break;
    case "svg":
      content = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="none" stroke="#7c8cff" stroke-width="2"/></svg>`;
      break;
    default:
      content = `Created by Maya on ${new Date().toLocaleString()}\n`;
  }

  const el = document.createElement("div");
  el.className = "maya-tool is-live file-card";

  const sizeStr = `${(new Blob([content]).size / 1024).toFixed(1)} KB`;

  el.innerHTML = `
    <div class="file-meta">
      <div class="file-name">${filename}</div>
      <div class="file-size">${sizeStr}</div>
    </div>
    <button class="file-download" aria-label="Download ${filename}">
      <span class="download-label">↓ download</span>
      <span class="stream"></span><span class="stream"></span><span class="stream"></span>
      <span class="stream"></span><span class="stream"></span><span class="stream"></span>
      <span class="stream"></span><span class="stream"></span><span class="stream"></span>
      <span class="stream"></span><span class="stream"></span><span class="stream"></span>
    </button>
    <div class="file-note"></div>`;

  const btn = el.querySelector(".file-download");
  const note = el.querySelector(".file-note");
  const streams = el.querySelectorAll(".stream");

  // Magical download — particles stream down the button like data transferring.
  btn.addEventListener("click", () => {
    if (btn.classList.contains("is-saved")) return;

    // Create blob and trigger download
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    // Animate the streaming particles
    note.textContent = "transferring...";
    streams.forEach((s, i) => {
      s.style.opacity = "0";
      s.style.left = `${12 + (i / streams.length) * 108}px`;
      s.style.top = "-8px";
      s.style.animation = `maya-stream-down ${0.4 + Math.random() * 0.3}s ease-in ${i * 0.06}s forwards`;
    });

    setTimeout(() => {
      btn.classList.add("is-saved");
      btn.querySelector(".download-label").textContent = "✓ saved";
      note.textContent = "transferred to your device";
      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 2000);
    }, streams.length * 60 + 400);

    // After a beat, dissolve the whole card
    setTimeout(() => {
      el.classList.add("is-dissolving");
      el.dispatchEvent(new CustomEvent("maya:complete"));
      setTimeout(() => el.remove(), 600);
    }, 2000);
  });

  el._maya = { destroy: () => {} };
  return el;
});
