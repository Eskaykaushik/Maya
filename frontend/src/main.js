import { Maya } from "./core/maya.js";

const maya = new Maya({
  canvas: document.getElementById("maya-canvas"),
  stage: document.getElementById("maya-stage"),
  promptEl: document.getElementById("maya-prompt"),
  transcriptEl: document.getElementById("maya-transcript"),
  inputEl: document.getElementById("maya-input"),
  chooserEl: document.getElementById("maya-chooser"),
  voiceEl: document.getElementById("maya-voice"),
});

window.__maya = maya;
maya.init();
