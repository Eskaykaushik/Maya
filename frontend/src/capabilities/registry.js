/**
 * Capabilities — the registry for everything Maya can do.
 *
 * Bridge phase: the 7 legacy tools still live in `tools/` and self-register
 * into the legacy `Registry`. This module is the seam the core talks to and
 * embodies the manifest contract (`id · description · match · input ·
 * execute · materialize`) that G4 migrates the tools onto.
 *
 *   resolve(text)          → tier-1 intent {experience, action, params} | null
 *   materialize(name, params) → a live `.maya-tool` element | null
 *
 * A future capability registers itself either through `register(manifest)`
 * (converted here into the legacy shape) or — after G4 — purely as a
 * manifest.
 */

import { Registry } from "../tools/registry.js";

export const Capabilities = {
  /**
   * Tier-1 offline intent. Delegates to the legacy registry (which includes
   * the summon fallback for "show/open the calculator…").
   */
  resolve(text) {
    return Registry.matchIntent(text);
  },

  /**
   * Materialize a capability as a live tool element on the stage.
   */
  materialize(name, params) {
    return Registry.create(name, params || {});
  },

  /**
   * Register a capability manifest. G4 compatibility shim: a future manifest
   * is converted into the legacy `register` + `implement` pair so existing
   * tools and this bridge coexist until migration completes.
   */
  register(manifest) {
    if (!manifest || !manifest.id) return;
    const id = manifest.id;
    Registry.register({
      name: id,
      description: manifest.description || "",
      match: manifest.match,
    });
    const materialize = manifest.materialize;
    if (materialize) {
      const renderer = materialize.element || materialize.spec;
      if (renderer) Registry.implement(id, renderer);
    }
  },

  list() {
    return [...Registry.tools.keys()];
  },

  get(name) {
    return Registry.get(name);
  },
};