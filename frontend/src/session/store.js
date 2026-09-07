/**
 * In-memory conversation store.
 *
 * Maya is offline-first — no data leaves the browser unless the user taps
 * into the backend or a tool calls an API. The store captures a compact
 * trace of the current session (intent, surface, UI spec, component states,
 * results, conversation) so the orchestrator can reason about it.
 *
 * The session is ephemeral by design: a refresh restarts the chat from an
 * empty thread. Nothing is written to storage.
 */

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const MAKE_DEFAULT = () => ({
  session_id: generateId(),
  conversation: [],
  surface: "response",
  intent: null,
  uiSpec: null,
  componentStates: {},
  results: null,
  reply: null,
});

let state = MAKE_DEFAULT();

export const Store = {
  get() {
    return state;
  },

  update(patch) {
    if (!patch || typeof patch !== "object") return;
    Object.assign(state, patch);
  },

  reset() {
    state = MAKE_DEFAULT();
    return state;
  },

  /** Plain snapshot — no reactivity, no hooks. */
  snapshot() {
    return state;
  },
};
