/* session/store — the observable screen model, persisted to localStorage.
 * The frontend owns ONE screen: a calm response OR a generated interface —
 * tracked as state (never decoration). Each turn ships a compact ui_state
 * snapshot, so follow-ups resolve against whatever is actually on screen. */

import { EventBus } from "../events/eventbus.js";

const KEY = "maya:session:v1";
const MAX_CONVERSATION = 40;

function fresh() {
  return {
    sessionId: String(Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    surface: "response", // "response" | "interface" — never both
    intent: null,
    uiSpec: null,
    componentStates: {},
    results: null,
    reply: null,
    conversation: [],
  };
}

let state = fresh();

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved && typeof saved.sessionId === "string") {
      // Reloads keep the thread + sessionId, but never restore a live
      // interface — the screen re-derives from the next turn.
      state = Object.assign(fresh(), saved, {
        surface: "response",
        uiSpec: null,
        results: null,
        reply: null,
      });
      state.conversation = (state.conversation || []).slice(-MAX_CONVERSATION);
    }
  }
} catch {
  /* private browsing / quota — start fresh */
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export const Store = {
  get: () => state,

  update(patch) {
    state = Object.assign({}, state, patch);
    persist();
    EventBus.emit("session:update", { surface: state.surface });
  },

  /** Compact context for follow-ups — ships as ui_state to the backend. */
  snapshot() {
    return {
      session_id: state.sessionId,
      ui_state: {
        surface: state.surface,
        intent: state.intent,
        uiSpec: state.uiSpec,
        componentStates: state.componentStates,
        results: state.results,
        reply: state.reply,
      },
    };
  },
};