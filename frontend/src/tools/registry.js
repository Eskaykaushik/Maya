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
