/* Line-level diff — the first domain primitive. Compares two texts line by
 * line and returns an edit script of same/del/ins rows, plus cheap stats. */

const MAX_LINES = 700;

export function diffLines(aText, bText) {
  const a = aText == null || aText === "" ? [] : String(aText).split(/\r?\n/);
  const b = bText == null || bText === "" ? [] : String(bText).split(/\r?\n/);
  return lcsEdit(a, b).map((item) => ({ type: item.t, line: item.line }));
}

export function diffStats(aText, bText) {
  const stats = { removed: 0, added: 0, changed: 0 };
  for (const item of diffLines(aText, bText)) {
    if (item.type === "del") {
      stats.removed++;
      stats.changed++;
    } else if (item.type === "ins") {
      stats.added++;
      stats.changed++;
    }
  }
  return stats;
}

function lcsEdit(a, b) {
  if (a.length > MAX_LINES || b.length > MAX_LINES) return coarseEdit(a, b);

  const n = a.length;
  const m = b.length;
  const stride = m + 1;
  const dp = new Uint16Array((n + 1) * stride);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * stride + j] = a[i] === b[j]
        ? dp[(i + 1) * stride + j + 1] + 1
        : Math.max(dp[(i + 1) * stride + j], dp[i * stride + j + 1]);
    }
  }

  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ t: "same", line: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * stride + j] >= dp[i * stride + j + 1]) {
      out.push({ t: "del", line: a[i] });
      i++;
    } else {
      out.push({ t: "ins", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ t: "del", line: a[i] });
    i++;
  }
  while (j < m) {
    out.push({ t: "ins", line: b[j] });
    j++;
  }
  return out;
}

function coarseEdit(a, b) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let e = 0;
  while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;

  const out = [];
  for (let i = 0; i < s; i++) out.push({ t: "same", line: a[i] });
  for (let i = s; i < a.length - e; i++) out.push({ t: "del", line: a[i] });
  for (let i = s; i < b.length - e; i++) out.push({ t: "ins", line: b[i] });
  for (let i = a.length - e; i < a.length; i++) out.push({ t: "same", line: a[i] });
  return out;
}