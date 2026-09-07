/**
 * Local-storage backed conversation store.
 *
 * Maya is offline-first — no data leaves the browser unless the user
 * taps into Groq or an MCP tool explicitly calls fetch. The store
 * captures a compact trace of the session (intent, surface, UI spec,
 * component states, results) so a future "session report" layer can
 * summarise and export it.
 */

const STORAGE_KEY = "maya_state";
const SESSION_KEY = "maya_session";

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadSessionId() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const id = generateId();
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(id)); } catch {}
  return id;
}

const DEFAULTS = {
  session_id: loadSessionId(),
  conversation: [],
  surface: "response",
  intent: null,
  uiSpec: null,
  componentStates: {},
  results: null,
  reply: null,
};

export const Store = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object" && Array.isArray(saved.conversation)) {
          return { ...DEFAULTS, ...saved };
        }
      }
    } catch {}
    return { ...DEFAULTS, conversation: [] };
  },

  update(patch) {
    if (!patch || typeof patch !== "object") return;
    const state = this.get();
    Object.assign(state, patch);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  },

  reset() {
    const fresh = { ...DEFAULTS, session_id: generateId() };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh.session_id)); } catch {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
    return fresh;
  },

  /** Plain snapshot — no reactivity, no hooks. */
  snapshot() {
    return this.get();
  },
};
