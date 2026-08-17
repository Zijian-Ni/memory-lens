import { walkMarkdown } from './walk.js';
import { parseFile } from './parse.js';
import { estimateTokens, TOKEN_METHOD } from './tokens.js';

/**
 * Walk a memory directory and report file / entry / token / date / section stats.
 */
export function inventory(dir) {
  const files = walkMarkdown(dir);
  const entries = [];
  const fileStats = [];

  for (const file of files) {
    const parsed = parseFile(file, dir);
    entries.push(...parsed);
    fileStats.push({
      file: parsed[0]?.file || file,
      entries: parsed.length,
      tokens: parsed.reduce((n, e) => n + e.tokens, 0),
    });
  }

  const dates = [];
  for (const e of entries) {
    if (e.fileDate) dates.push(e.fileDate);
    for (const d of e.citedDates) dates.push(d);
    if (e.updatedAt) dates.push(e.updatedAt);
  }
  dates.sort();

  const sections = {};
  for (const e of entries) {
    const key = e.section || '(root)';
    if (!sections[key]) sections[key] = { section: key, entries: 0, tokens: 0 };
    sections[key].entries += 1;
    sections[key].tokens += e.tokens;
  }

  const totalTokens = entries.reduce((n, e) => n + e.tokens, 0);
  const sectionList = Object.values(sections).sort((a, b) => b.entries - a.entries);

  return {
    dir,
    files: files.length,
    entries: entries.length,
    tokens: totalTokens,
    tokenMethod: TOKEN_METHOD,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    sections: sectionList,
    fileStats,
    items: entries,
  };
}

export { estimateTokens };
