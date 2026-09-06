import { Registry } from "./registry.js";

const STORAGE_KEY = "maya-notes";

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveNotes(notes) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }
  catch { /* quota */ }
}

Registry.register({
  name: "notes",
  description: "Ephemeral scratchpad — notes persist across sessions",
  match(text) {
    if (/notes?|scratch|jot|remind|memo/i.test(text)) {
      return { action: "open" };
    }
    return null;
  },
});

Registry.implement("notes", () => {
  const notes = loadNotes();
  const el = document.createElement("div");
  el.className = "maya-tool is-live";

  const textarea = document.createElement("textarea");
  textarea.className = "notes-textarea";
  textarea.placeholder = "jot something down...";
  textarea.value = notes.length ? notes.join("\n\n") : "";

  const hint = document.createElement("div");
  hint.className = "notes-hint";
  hint.textContent = "saved to local memory";

  el.appendChild(textarea);
  el.appendChild(hint);

  // Focus styling
  textarea.addEventListener("focus", () => {
    textarea.style.borderColor = "rgba(255,255,255,0.18)";
    textarea.style.boxShadow = "0 0 20px rgba(120,140,255,0.06)";
  });
  textarea.addEventListener("blur", () => {
    textarea.style.borderColor = "";
    textarea.style.boxShadow = "";
  });

  // Auto-save on input
  textarea.addEventListener("input", () => {
    const content = textarea.value;
    saveNotes(content ? content.split(/\n\n+/).filter(Boolean) : []);
    hint.textContent = "saved to local memory";
    hint.style.color = "rgba(160,230,190,0.6)";
    setTimeout(() => { hint.style.color = ""; }, 800);
  });

  function finish() {
    el.classList.add("is-dissolving");
    el.dispatchEvent(new CustomEvent("maya:complete"));
    setTimeout(() => el.remove(), 600);
  }

  el._maya = { destroy: () => {} };
  setTimeout(() => textarea.focus(), 400);
  return el;
});
