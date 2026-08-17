/**
 * The viewer is plain ES modules loaded straight from disk, so a single
 * `node:fs` import anywhere in its dependency graph takes the whole page down
 * with a CORS error -- and the CLI tests keep passing while it does, because
 * Node resolves those imports happily.
 *
 * That is exactly how the viewer shipped broken once. These tests walk the
 * modules the browser actually loads and fail if any of them reaches for Node.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const INDEX_HTML = fileURLToPath(new URL('../index.html', import.meta.url));

/** Entry points the browser loads directly. */
const BROWSER_ENTRIES = ['app.js'];

const NODE_BUILTIN = /from\s+['"]node:([a-z_/]+)['"]/g;
const RELATIVE_IMPORT = /from\s+['"](\.[^'"]+)['"]/g;

/**
 * Strip comments before matching. These files document the very rule being
 * enforced, and prose describing `node:fs` must not read as an import of it.
 */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/** Follow relative imports from an entry file and return every module reached. */
function moduleGraph(entry) {
  const seen = new Set();
  const queue = [resolve(SRC, entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    let source;
    try {
      source = code(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      queue.push(resolve(dirname(file), match[1]));
    }
  }
  return [...seen];
}

describe('the viewer never imports Node built-ins', () => {
  for (const entry of BROWSER_ENTRIES) {
    it(`${entry} and everything it pulls in stays browser-safe`, () => {
      const offenders = [];
      for (const file of moduleGraph(entry)) {
        const source = code(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(NODE_BUILTIN)) {
          offenders.push(`${file.replace(SRC, 'src/')} imports node:${match[1]}`);
        }
      }
      assert.deepEqual(
        offenders,
        [],
        `these modules would break the viewer in a browser:\n  ${offenders.join('\n  ')}`
      );
    });
  }

  it('reaches the modules it is supposed to, so the walk is not vacuous', () => {
    // A guard that silently walks nothing would pass forever.
    const graph = moduleGraph('app.js').map((f) => f.replace(SRC, ''));
    for (const expected of ['parse.js', 'dupes.js', 'decay.js', 'tokens.js', 'i18n.js']) {
      assert.ok(graph.includes(expected), `expected the graph to include ${expected}, got ${graph.join(', ')}`);
    }
  });

  it('keeps filesystem access in the Node-only parser', () => {
    // parse.js is shared with the browser; parse-node.js is where fs belongs.
    assert.equal(code(readFileSync(join(SRC, 'parse.js'), 'utf8')).includes('node:fs'), false);
    assert.ok(code(readFileSync(join(SRC, 'parse-node.js'), 'utf8')).includes('node:fs'));
  });
});

describe('index.html only references files that exist', () => {
  it('resolves every local script and stylesheet', () => {
    const html = readFileSync(INDEX_HTML, 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => !h.startsWith('data:') && !h.startsWith('http'));
    assert.ok(refs.length > 0, 'expected index.html to reference local assets');
    for (const ref of refs) {
      assert.doesNotThrow(
        () => readFileSync(fileURLToPath(new URL(`../${ref}`, import.meta.url))),
        `index.html references ${ref}, which does not exist`
      );
    }
  });
});
