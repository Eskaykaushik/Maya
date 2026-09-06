import { Maya } from "./core/maya.js";

const CONTRACT_A = `SERVICE AGREEMENT

1. Scope — Provider manages backup storage.
2. Term — 12 months from signature.
3. Liability — Provider is not liable for indirect losses.
4. Fees — 400 units per month.
5. Termination — 30 days written notice.`;

const CONTRACT_B = `SERVICE AGREEMENT

1. Scope — Provider manages backup storage and replication.
2. Term — 12 months from signature, auto-renewed.
3. Liability — Provider is not liable for indirect or consequential losses.
4. Fees — 500 units per month.
5. Termination — 30 days written notice.
6. Data — Client retains all rights.`;

const maya = new Maya({
  canvas: document.getElementById("maya-canvas"),
  stage: document.getElementById("maya-stage"),
  promptEl: document.getElementById("maya-prompt"),
  transcriptEl: document.getElementById("maya-transcript"),
  whisperEl: document.getElementById("maya-whisper"),
  chatEl: document.getElementById("maya-chat"),
  inputEl: document.getElementById("maya-input"),
  chooserEl: document.getElementById("maya-chooser"),
  voiceEl: document.getElementById("maya-voice"),
});

window.__maya = maya;
const boot = maya.init();

const params = new URLSearchParams(location.search);
if (params.get("spec") === "demo") {
  const spec = {
    type: "document_diff",
    components: [
      { type: "file", id: "srcA", label: "Contract A", accept: ["txt", "md"] },
      { type: "file", id: "srcB", label: "Contract B", accept: ["txt", "md"] },
      { type: "button", id: "compare", label: "Compare" },
      { type: "diff", id: "out", sourceA: "srcA", sourceB: "srcB" },
    ],
  };
  const sources = {
    srcA: { name: "contract-a.txt", text: CONTRACT_A },
    srcB: { name: "contract-b.txt", text: CONTRACT_B },
  };

  boot.then(() => {
    maya.showSpec(spec, { sources, reply: "comparing contracts…" });
    if (params.get("auto") === "1") {
      setTimeout(() => {
        const handle = maya.interface;
        const slot = handle && handle.slots.get("compare");
        const btn = slot && slot.el && slot.el.querySelector(".ghost-btn");
        if (btn) btn.click();
      }, 1800);
    }
  });
}
