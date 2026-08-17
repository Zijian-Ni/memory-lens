/**
 * Node-only file reading.
 *
 * Kept apart from parse.js so the parser itself stays importable in a browser.
 * The viewer never loads this file; the CLI does.
 */
import fs from 'node:fs';
import { parseMarkdown } from './parse.js';
import { relFrom } from './walk.js';

export function parseFile(file, root) {
  const text = fs.readFileSync(file, 'utf8');
  return parseMarkdown(text, {
    file,
    root,
    rel: relFrom(root, file),
    mtime: safeMtime(file),
  });
}

function safeMtime(file) {
  try {
    return fs.statSync(file).mtime;
  } catch {
    // A file that vanished between the walk and the read is not worth crashing
    // over; it simply has no recorded mtime.
    return null;
  }
}
