import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { inventory, parseMarkdown, estimateTokens } from '../src/index.js';
import { writeSyntheticMemory, rmrf } from './fixtures.js';

describe('inventory + provenance', () => {
  let dir;
  before(() => { dir = writeSyntheticMemory(); });
  after(() => { rmrf(dir); });

  it('walks markdown and reports file / entry / token / section counts', () => {
    const inv = inventory(dir);
    assert.ok(inv.files >= 5, `expected ≥5 files, got ${inv.files}`);
    assert.ok(inv.entries >= 10, `expected ≥10 entries, got ${inv.entries}`);
    assert.ok(inv.tokens > 50);
    assert.match(inv.tokenMethod, /CJK/);
    assert.ok(inv.dateRange, 'date range should be present');
    assert.equal(inv.dateRange.from <= inv.dateRange.to, true);
    const names = inv.sections.map((s) => s.section);
    assert.ok(names.includes('Lessons 教训') || names.includes('Preferences 偏好'));
  });

  it('attaches file#line provenance to every entry', () => {
    const inv = inventory(dir);
    for (const e of inv.items) {
      assert.match(e.provenance, /^.+#\d+$/, e.provenance);
      assert.equal(e.provenance, `${e.file}#${e.line}`);
      assert.equal(typeof e.line, 'number');
      assert.ok(e.line >= 1);
      assert.ok(e.endLine >= e.line);
      assert.ok(e.body.length > 0);
    }
  });

  it('scopes bullets under the nearest heading', () => {
    const text = `# Lessons\n\n- one fact\n- two fact\n`;
    const entries = parseMarkdown(text, { file: 'MEMORY.md' });
    assert.equal(entries.length, 2);
    assert.equal(entries[0].section, 'Lessons');
    assert.equal(entries[0].provenance, 'MEMORY.md#3');
    assert.equal(entries[1].provenance, 'MEMORY.md#4');
    assert.equal(entries[0].kind, 'bullet');
  });

  it('counts CJK characters as tokens (not as a single blob)', () => {
    const zh = estimateTokens('偏好本地优先的工具');
    const en = estimateTokens('prefer local first tools');
    const mixed = estimateTokens('偏好 local first');
    assert.equal(zh, 9, `CJK should count per character, got ${zh}`);
    assert.equal(en, 4, `latin whitespace split, got ${en}`);
    assert.equal(mixed, 4, `2 CJK + 2 latin words, got ${mixed}`);
    assert.notEqual(estimateTokens('偏好本地优先的工具'), 1);
  });
});
