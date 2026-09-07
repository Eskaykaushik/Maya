/**
 * Capabilities — the single import seam.
 *
 * The core imports exactly one module for all tooling: this one. Every
 * built-in capability self-registers on import (bridge phase: the legacy
 * `tools/*.js` modules self-register into the legacy registry, which the
 * `Capabilities` bridge exposes). A new capability is added by dropping a
 * module here + a self-registering import line — no edits to the core.
 */

import { Capabilities } from "./registry.js";

import "../tools/timer.js";
import "../tools/calculator.js";
import "../tools/stopwatch.js";
import "../tools/notes.js";
import "../tools/worldclock.js";
import "../tools/random.js";
import "../tools/filemaker.js";

export { Capabilities };