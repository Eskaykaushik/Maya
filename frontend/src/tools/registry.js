export const Registry = {
  tools: new Map(),
  _implementations: new Map(),

  register(tool) {
    this.tools.set(tool.name, tool);
  },

  implement(name, fn) {
    this._implementations.set(name, fn);
  },

  get(name) {
    return this.tools.get(name);
  },

  /**
   * Offline pattern tier — tries every tool's `match` fn, returns
   * a normalized intent or null if none fire.
   */
  matchIntent(text) {
    const t = (text || "").toLowerCase().trim();
    for (const tool of this.tools.values()) {
      if (tool.match) {
        const result = tool.match(t);
        if (result) {
          return {
            experience: tool.name,
            action: result.action || "default",
            params: result.params || {},
          };
        }
      }
    }
    // Summon fallback — "show calc", "open the calculator", "calc",
    // "bring up a timer"… open the named tool directly, no model needed.
    return this._matchSummon(t);
  },

  /**
   * Deterministic open/show path. Runs only after every tool matcher has
   * had its say, so arithmetic still computes and "flip a coin" still rolls.
   */
  _matchSummon(text) {
    const verb = /^(?:show|open|launch|bring up|display|start|use|do)\b(?:\s+(?:me|us|the|a|an|my|up))?\s*/i;
    const rest = text.replace(verb, "").trim();
    const aliases = [
      ["calculator", /\bcalc(?:ulator|ulate|ulation)?s?\b/i],
      ["filemaker", /\b(filemaker|file maker|make files?)\b/i],
      ["random", /\b(random|dice|die|coin|rolls?|flip)\b/i],
      ["notes", /\b(notes?|scratchpad|memo|jot)\b/i],
      ["timer", /\b(timer|countdown|alarm|alarms?)\b/i],
      ["stopwatch", /\b(stopwatch|stop watch|lap timer|seconds counter)\b/i],
      ["worldclock", /\b(world ?clock|time ?zones?|clocks?)\b/i],
    ];
    for (const [name, re] of aliases) {
      if (re.test(rest)) {
        const params = name === "filemaker" ? { extension: "txt" } : {};
        return { experience: name, action: "summon", params };
      }
    }
    return null;
  },

  /**
   * The core dispatch — given a resolved intent, materialize the tool.
   * `create` returns the rendered experience object from the implementation.
   */
  create(name, params) {
    const impl = this._implementations.get(name);
    if (!impl) return null;
    return impl(params || {});
  },
};
