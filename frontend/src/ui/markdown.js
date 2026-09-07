/*
 * markdown — a compact, dependency-free markdown → DOM renderer.
 *
 * Safety model: this module never turns string content into an HTML string.
 * Every token is built with document.createElement + textContent, and links
 * accept only http(s)/mailto URLs — so arbitrary input can only ever render
 * as formatted text, never as markup or script. (Maya is zero-build and
 * offline-first; a CDN parser was a deliberate non-goal.)
 *
 * Supports: paragraphs, headings #-######, ordered/unordered lists (one level
 * of nesting), fenced + indented code blocks, blockquotes, thematic breaks,
 * GFM tables, inline code, *emphasis*, **strong**, ~~strike~~, images (alt
 * only), [links](url) and bare http(s):// autolinks.
 */

const el = (tag, className) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

const textNode = (s) => document.createTextNode(s == null ? "" : String(s));

const SAFE_HREF = /^(https?:|mailto:)/i;

function linkHref(raw) {
  const url = String(raw || "").trim().replace(/^<|>$/g, "");
  if (!SAFE_HREF.test(url)) return null;
  const a = el("a");
  a.href = url;
  a.rel = "noopener";
  a.target = "_blank";
  return a;
}

/* ------------------------------------------------------------------ *
 *  Inline — a scanner that consumes one token at a time.
 * ------------------------------------------------------------------ */

function renderInline(text) {
  const frag = document.createDocumentFragment();
  let src = text == null ? "" : String(text);
  let i = 0;

  const pushText = (s) => {
    if (s) frag.appendChild(textNode(s));
  };

  while (i < src.length) {
    const rest = src.slice(i);

    // Bare / angled http(s) link.
    const url = rest.match(/^(?:<|)(https?:\/\/[^\s<>"']+)(?:>|)/);
    if (url) {
      let href = url[1];
      if (href.endsWith(")")) {
        const open = (href.match(/\(/g) || []).length;
        const close = (href.match(/\)/g) || []).length;
        if (close > open) href = href.slice(0, -1);
      }
      href = href.replace(/[.,;:!?]+$/, "");
      const a = linkHref(href);
      if (a) {
        a.textContent = href;
        frag.appendChild(a);
        i += url[0].length;
        continue;
      }
    }

    // Inline code.
    const code = rest.match(/^`+([^`]+)`+/);
    if (code) {
      const c = el("code");
      c.textContent = code[1];
      frag.appendChild(c);
      i += code[0].length;
      continue;
    }

    // Image → alt text only (no remote embeds).
    const img = rest.match(/^!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
    if (img) {
      pushText(img[1] || "");
      i += img[0].length;
      continue;
    }

    // Link [text](url).
    const link = rest.match(/^\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
    if (link) {
      const a = linkHref(link[2]);
      if (a) {
        a.appendChild(renderInline(link[1]));
        frag.appendChild(a);
        i += link[0].length;
        continue;
      }
    }

    // Strong **…** / __…__.
    const strong = rest.match(/^\*\*(?=\S)([\s\S]*?\S)\*\*/) || rest.match(/^__(?=\S)([\s\S]*?\S)__/);
    if (strong) {
      const s = el("strong");
      s.appendChild(renderInline(strong[1]));
      frag.appendChild(s);
      i += strong[0].length;
      continue;
    }

    // Strike ~~…~~.
    const strike = rest.match(/^~~(?=\S)([\s\S]*?\S)~~/);
    if (strike) {
      const s = el("s");
      s.appendChild(renderInline(strike[1]));
      frag.appendChild(s);
      i += strike[0].length;
      continue;
    }

    // Emphasis *…* / _…_ (avoid matching after a word-boundary star pair).
    const em = rest.match(/^\*(?!\*| )(?=\S)([^*\n]*?\S)\*/) || rest.match(/^_(?!_| )(?=\S)([^_\n]*?\S)_/);
    if (em) {
      const e = el("em");
      e.appendChild(renderInline(em[1]));
      frag.appendChild(e);
      i += em[0].length;
      continue;
    }

    // Escaped character.
    if (rest[0] === "\\" && rest[1]) {
      pushText(rest[1]);
      i += 2;
      continue;
    }

    // Plain run up to the next special character or http:// token.
    const mark = rest.search(/[\\`*_~[\]!<>]|https?:\/\//);
    if (mark === 0) {
      pushText(rest[0]);
      i += 1;
      continue;
    }
    const run = mark > 0 ? rest.slice(0, mark) : rest;
    if (run) {
      pushText(run);
      i += run.length;
      continue;
    }
    i += 1;
  }

  return frag;
}

/* ------------------------------------------------------------------ *
 *  Blocks — line-based parsing into a token list.
 * ------------------------------------------------------------------ */

const isBlank = (line) => line.trim() === "";

function isBlockStart(line) {
  return (
    /^\s*(```|~~~)/.test(line) ||
    /^\s{0,3}#{1,6}\s/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d{1,9}[.)]\s+/.test(line) ||
    /^( {4}|\t)/.test(line)
  );
}

function isTableSep(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && /\|/.test(line);
}

function tokenize(src) {
  const lines = String(src == null ? "" : src)
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    // Fenced code.
    const fence = line.match(/^\s*(```+|~~~+)\s*([\w+-]*)\s*$/);
    if (fence) {
      const marker = fence[1][0];
      const lang = fence[2];
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(new RegExp(`^\\s*${marker}{3,}\\s*$`))) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing fence
      out.push({ type: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    // Heading.
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      out.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    // Thematic break.
    if (/^\s{0,3}(-\s*){3,}$/.test(line) || /^\s{0,3}(\*\s*){3,}$/.test(line) || /^\s{0,3}(_\s*){3,}$/.test(line)) {
      out.push({ type: "hr" });
      i++;
      continue;
    }

    // Blockquote.
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push({ type: "quote", raw: quote.join("\n") });
      continue;
    }

    // List.
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d{1,9}[.)]\s+/.test(line)) {
      const ordered = /^\s*\d{1,9}[.)]\s+/.test(line);
      const parentIndent = (line.match(/^\s*/) || [""])[0].length;
      const markerRe = ordered ? /^(\s*)(\d{1,9})[.)]\s+(.*)$/ : /^(\s*)[-*+]\s+(.*)$/;
      const childRe = ordered ? /^(\s+)(\d{1,9})[.)]\s+(.*)$/ : /^(\s+)[-*+]\s+(.*)$/;
      const contentIdx = ordered ? 3 : 2;
      const items = [];
      let itemLines = [];

      const closeItem = () => {
        if (itemLines.length) {
          items.push({ raw: itemLines.join("\n") });
          itemLines = [];
        }
      };

      while (i < lines.length && !isBlank(lines[i])) {
        const line = lines[i];
        const mm = line.match(markerRe);
        const cm = line.match(childRe);
        if (mm && mm[1].length <= parentIndent) {
          closeItem();
          itemLines.push(mm[contentIdx]);
        } else if (cm && cm[1].length > parentIndent) {
          itemLines.push(`\u0000${cm[contentIdx]}`);
        } else if (mm) {
          itemLines.push(mm[contentIdx]);
        } else if (cm) {
          itemLines.push(`\u0000${cm[contentIdx]}`);
        } else {
          itemLines.push(line.replace(/^\s+/, ""));
        }
        i++;
      }
      closeItem();
      out.push({ type: "list", ordered, items });
      continue;
    }

    // Indented code.
    if (/^( {4}|\t)/.test(line)) {
      const codeLines = [];
      while (i < lines.length && /^( {4}|\t)/.test(lines[i])) {
        codeLines.push(lines[i].replace(/^( {4}|\t)/, ""));
        i++;
      }
      out.push({ type: "code", lang: "", code: codeLines.join("\n") });
      continue;
    }

    // GFM table.
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const cells = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push({ type: "table", header, rows });
      continue;
    }

    // Paragraph.
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines[i]) && !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      para.push(lines[i]);
      i++;
    }
    out.push({ type: "paragraph", raw: para.join("\n") });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 *  Block → DOM.
 * ------------------------------------------------------------------ */

function renderBlocks(tokens) {
  const frag = document.createDocumentFragment();

  for (const tok of tokens) {
    switch (tok.type) {
      case "paragraph": {
        const p = el("p");
        p.appendChild(renderInline(tok.raw));
        frag.appendChild(p);
        break;
      }

      case "heading": {
        const h = el(`h${Math.min(6, Math.max(1, tok.level))}`);
        h.appendChild(renderInline(tok.text));
        frag.appendChild(h);
        break;
      }

      case "code": {
        const pre = el("pre");
        const code = el(tok.lang ? "code" : "code");
        code.textContent = tok.code;
        if (tok.lang) pre.setAttribute("data-lang", tok.lang);
        pre.appendChild(code);
        frag.appendChild(pre);
        break;
      }

      case "quote": {
        const bq = el("blockquote");
        bq.appendChild(renderBlocks(tokenize(tok.raw)));
        frag.appendChild(bq);
        break;
      }

      case "hr":
        frag.appendChild(el("hr"));
        break;

      case "list": {
        const list = el(tok.ordered ? "ol" : "ul");
        for (const item of tok.items) {
          const li = el("li");
          const lines = item.raw.split("\n");
          const nested = [];
          const top = [];
          for (const l of lines) {
            if (l.startsWith("\u0000")) {
              const child = l.slice(1);
              const childMarker = child.match(/^(\d{1,9}[.)]|[-*+])\s+(.*)$/);
              if (childMarker) nested.push({ ordered: /^\d/.test(childMarker[1]), raw: childMarker[2] });
            } else {
              top.push(l);
            }
          }
          li.appendChild(renderBlocks(tokenize(top.join("\n"))));
          if (nested.length) {
            const n = el("ul");
            for (const c of nested) {
              const nli = el("li");
              nli.appendChild(renderBlocks(tokenize(c.raw)));
              n.appendChild(nli);
            }
            li.appendChild(n);
          }
          list.appendChild(li);
        }
        frag.appendChild(list);
        break;
      }

      case "table": {
        const table = el("table");
        if (tok.header.length) {
          const thead = el("thead");
          const tr = el("tr");
          for (const cell of tok.header) {
            const th = el("th");
            th.appendChild(renderInline(cell));
            tr.appendChild(th);
          }
          thead.appendChild(tr);
          table.appendChild(thead);
        }
        if (tok.rows.length) {
          const tbody = el("tbody");
          for (const row of tok.rows) {
            const tr = el("tr");
            for (const cell of row) {
              const td = el("td");
              td.appendChild(renderInline(cell));
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
        }
        frag.appendChild(table);
        break;
      }
    }
  }

  return frag;
}

export function renderMarkdown(text) {
  return renderBlocks(tokenize(text));
}