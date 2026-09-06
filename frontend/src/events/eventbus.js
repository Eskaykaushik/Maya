/* events/eventbus — the tiny in-browser vocabulary.
 * Names: intent · ui:spec · ui:action · tool:run · tool:result · session:update */

export const EventBus = {
  _handlers: new Map(),

  on(name, fn) {
    let list = this._handlers.get(name);
    if (!list) {
      list = [];
      this._handlers.set(name, list);
    }
    list.push(fn);
    return () => {
      const l = this._handlers.get(name);
      if (!l) return;
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    };
  },

  emit(name, detail) {
    const list = this._handlers.get(name);
    if (!list) return;
    for (const fn of list.slice()) {
      try {
        fn(detail || {});
      } catch {
        /* one bad listener must not break the turn */
      }
    }
  },
};