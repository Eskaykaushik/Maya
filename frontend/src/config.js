// Maya — global configuration (loaded before the ES module graph).
// Window-load safety: this file runs as a plain script so the modules can read it.

window.MAYA = Object.assign(window.MAYA || {}, {
  // Intelligence backend — kaushix-api (Render), exposes POST /api/maya.
  // Maya is fully standalone without this — it only uses it for ambiguous
  // intents and rich file-content generation. Leave blank to disable.
  apiUrl: "https://kaushix-api-service.onrender.com",

  // Landing region for the magical, unpredictable placement engine:
  // the fraction of the viewport the interfaces may appear within.
  placement: {
    xMin: 0.16,
    xMax: 0.84,
    yMin: 0.14,
    yMax: 0.86,
    maxSizeFraction: 0.6,
  },
});
