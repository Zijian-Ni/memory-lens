import fs from 'node:fs';
import path from 'node:path';
import { estimateTokens } from './tokens.js';
import { relFrom } from './walk.js';

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const BULLET_RE = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/;
const ISO_DATE_RE = /\b(20\d{2}-\d{2}-\d{2})\b/;
const FILENAME_DATE_RE = /(20\d{2}-\d{2}-\d{2})/;

/**
 * Parse a markdown document into heading- or bullet-scoped entries.
 * Every entry carries `file#line` provenance so a human can find and fix it.
 */
export function parseMarkdown(text, { file = 'MEMORY.md', root = '.' } = {}) {
  const lines = String(text ?? '').split(/\r?\n/);
  const rel = file.includes(path.sep) || file.includes('/') ? relFrom(root, file) : file;
  const fileDate = extractFileDate(rel);
  const fileMtime = safeMtime(file);

  /** @type {Array<{level:number, title:string, line:number}>} */
  const headingStack = [];
  const entries = [];
  let preamble = [];
  let preambleStart = 1;

  const flushPreamble = () => {
    const body = preamble.join('\n').trim();
    if (body) {
      entries.push(makeEntry({
        rel,
        startLine: preambleStart,
        endLine: preambleStart + preamble.length - 1,
        headingPath: headingStack.map((h) => h.title),
        kind: headingStack.length ? 'prose' : 'preamble',
        body,
        fileDate,
        fileMtime,
      }));
    }
    preamble = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    const heading = raw.match(HEADING_RE);
    if (heading) {
      flushPreamble();
      const level = heading[1].length;
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, title: heading[2].trim(), line: lineNo });
      preambleStart = lineNo + 1;
      continue;
    }

    const bullet = raw.match(BULLET_RE);
    if (bullet) {
      flushPreamble();
      const indent = bullet[1].length;
      const bodyLines = [bullet[3]];
      let j = i + 1;
      while (j < lines.length) {
        const nxt = lines[j];
        if (!nxt.trim()) {
          bodyLines.push('');
          j += 1;
          continue;
        }
        if (HEADING_RE.test(nxt)) break;
        const nxtBullet = nxt.match(BULLET_RE);
        if (nxtBullet && nxtBullet[1].length <= indent) break;
        if (nxtBullet) {
          // nested bullet — keep with parent as context, but also emit its own entry
          break;
        }
        if (/^\s{2,}\S/.test(nxt) || nxt.startsWith('\t')) {
          bodyLines.push(nxt.trim());
          j += 1;
          continue;
        }
        break;
      }
      const body = bodyLines.join('\n').trim();
      entries.push(makeEntry({
        rel,
        startLine: lineNo,
        endLine: j,
        headingPath: headingStack.map((h) => h.title),
        kind: 'bullet',
        body,
        fileDate,
        fileMtime,
      }));
      i = j - 1;
      preambleStart = j + 1;
      continue;
    }

    if (!preamble.length) preambleStart = lineNo;
    preamble.push(raw);
  }
  flushPreamble();

  return entries;
}

export function parseFile(file, root) {
  const text = fs.readFileSync(file, 'utf8');
  return parseMarkdown(text, { file, root });
}

function makeEntry({ rel, startLine, endLine, headingPath, kind, body, fileDate, fileMtime }) {
  const section = headingPath[0] || '(root)';
  const title = headingPath[headingPath.length - 1] || firstLine(body);
  return {
    id: `${rel}#${startLine}`,
    file: rel,
    line: startLine,
    endLine,
    provenance: `${rel}#${startLine}`,
    kind,
    headingPath,
    section,
    title,
    body,
    text: body,
    tokens: estimateTokens(body),
    fileDate,
    // Only filename / heading dates count as "updated". mtime is a filesystem
    // accident (clone, copy, CI) and must not outrank a dated daily note.
    updatedAt: fileDate,
    mtimeMs: fileMtime ? fileMtime.getTime() : 0,
    citedDates: extractCitedDates(body),
  };
}

function firstLine(body) {
  const line = String(body).split('\n').find((l) => l.trim());
  return line ? line.slice(0, 80) : '(empty)';
}

function extractFileDate(rel) {
  const m = String(rel).match(FILENAME_DATE_RE);
  return m ? m[1] : null;
}

function extractCitedDates(body) {
  const out = [];
  const re = new RegExp(ISO_DATE_RE.source, 'g');
  let m;
  while ((m = re.exec(body))) out.push(m[1]);
  return [...new Set(out)];
}

function safeMtime(file) {
  try {
    return fs.statSync(file).mtime;
  } catch {
    return null;
  }
}

export { ISO_DATE_RE, FILENAME_DATE_RE };
