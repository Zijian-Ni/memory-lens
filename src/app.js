import { initAuroraUI, toast, readout, assertSingleRing } from './vendor/aurora-ui.js';
import { parseMarkdown } from './parse.js';
import { findDuplicates } from './dupes.js';
import { scoreDecay } from './decay.js';
import { TOKEN_METHOD } from './tokens.js';
import { t, detectLang } from './i18n.js';

const state = {
  lang: detectLang(localStorage.getItem('ml-lang'), navigator),
  view: 'inventory',
  data: null,
  selected: null,
};

const $app = document.getElementById('app');

function esc(s) {
  const map = { 38: '&amp;', 60: '&lt;', 62: '&gt;', 34: '&quot;', 39: '&#39;' };
  return String(s ?? '').replace(/[&<>"']/g, (c) => map[c.charCodeAt(0)]);
}

function setLang(lang) {
  state.lang = lang === 'zh' ? 'zh' : 'en';
  localStorage.setItem('ml-lang', state.lang);
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  render();
}

function emptyInventory() {
  return {
    schema: 'aurora.memory-lens.v1',
    generatedAt: new Date().toISOString(),
    dir: '(browser)',
    inventory: { files: 0, entries: 0, tokens: 0, tokenMethod: TOKEN_METHOD, dateRange: null, sections: [] },
    entries: [],
    clusters: [],
    decay: [],
    timing: { dupesMs: 0, comparedPairs: 0 },
  };
}

function fromEntries(entries, dir = '(browser)') {
  const sections = {};
  for (const e of entries) {
    const key = e.section || '(root)';
    if (!sections[key]) sections[key] = { section: key, entries: 0, tokens: 0 };
    sections[key].entries += 1;
    sections[key].tokens += e.tokens;
  }
  const dates = [];
  for (const e of entries) {
    if (e.fileDate) dates.push(e.fileDate);
    if (e.updatedAt) dates.push(e.updatedAt);
    for (const d of e.citedDates || []) dates.push(d);
  }
  dates.sort();
  const dupes = findDuplicates(entries);
  const decay = scoreDecay(entries);
  const files = new Set(entries.map((e) => e.file)).size;
  return {
    schema: 'aurora.memory-lens.v1',
    generatedAt: new Date().toISOString(),
    dir,
    inventory: {
      files,
      entries: entries.length,
      tokens: entries.reduce((n, e) => n + e.tokens, 0),
      tokenMethod: TOKEN_METHOD,
      dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
      sections: Object.values(sections).sort((a, b) => b.entries - a.entries),
    },
    entries,
    clusters: dupes.clusters.map((c) => ({
      size: c.size,
      representative: c.representative,
      candidates: c.candidates,
      scores: c.scores,
    })),
    decay: decay.review.map((r) => ({
      id: r.entry.id,
      provenance: r.entry.provenance,
      score: r.score,
      reasons: r.reasons,
      ageDays: r.ageDays,
      title: r.entry.title,
      body: r.entry.body,
      section: r.entry.section,
    })),
    timing: { dupesMs: dupes.elapsedMs, comparedPairs: dupes.comparedPairs },
  };
}

function loadPayload(payload) {
  if (!payload || payload.schema !== 'aurora.memory-lens.v1') {
    throw new Error('Not a memory-lens export (missing schema aurora.memory-lens.v1)');
  }
  state.data = payload;
  state.view = 'inventory';
  render();
  toast(state.lang === 'zh' ? '已加载导出' : 'Export loaded', 'ok');
}

async function loadFiles(fileList) {
  const files = [...fileList].filter((f) => /\.(md|markdown|txt|json)$/i.test(f.name));
  if (!files.length) {
    toast(state.lang === 'zh' ? '没有找到 .md / .json' : 'No .md or .json files', 'warn');
    return;
  }
  const json = files.find((f) => /\.json$/i.test(f.name));
  if (json && files.length === 1) {
    const payload = JSON.parse(await json.text());
    loadPayload(payload);
    return;
  }
  const entries = [];
  for (const f of files.filter((x) => !/\.json$/i.test(x.name))) {
    const text = await f.text();
    const rel = f.webkitRelativePath || f.name;
    entries.push(...parseMarkdown(text, { file: rel, root: '.' }));
  }
  state.data = fromEntries(entries, files[0]?.webkitRelativePath?.split('/')[0] || '(dropped)');
  state.view = 'inventory';
  render();
  toast(state.lang === 'zh' ? `已解析 ${entries.length} 条` : `Parsed ${entries.length} entries`, 'ok');
}

function reasonLabel(code) {
  return t(state.lang, code);
}

function render() {
  const L = state.lang;
  const d = state.data;
  const inv = d?.inventory;
  $app.innerHTML = `
    <header class="appbar">
      <div class="row">
        <div>
          <h1 style="font-size:var(--text-lg);margin:0">${esc(t(L, 'name'))}</h1>
          <small>${esc(t(L, 'tagline'))}</small>
        </div>
      </div>
      <div class="row row--wrap">
        <button class="btn btn--ghost" data-act="lang">${L === 'en' ? '中文' : 'EN'}</button>
        <button class="btn btn--ghost" data-aurora-theme-toggle>${esc(t(L, 'theme'))}</button>
        <label class="btn btn--sm">
          ${esc(t(L, 'loadJson'))}
          <input id="file-json" class="u-visually-hidden" type="file" accept="application/json,.json">
        </label>
        <label class="btn btn--sm btn--primary">
          ${esc(t(L, 'loadDir'))}
          <input id="file-dir" class="u-visually-hidden" type="file" webkitdirectory multiple>
        </label>
      </div>
    </header>

    <main class="container stack" style="padding:var(--sp-5) 0 var(--sp-8)">
      ${d ? renderLoaded(L, d, inv) : renderEmpty(L)}
    </main>
  `;

  $app.querySelector('[data-act="lang"]')?.addEventListener('click', () => setLang(L === 'en' ? 'zh' : 'en'));
  $app.querySelector('#file-json')?.addEventListener('change', (e) => loadFiles(e.target.files));
  $app.querySelector('#file-dir')?.addEventListener('change', (e) => loadFiles(e.target.files));
  $app.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => { state.view = btn.dataset.view; render(); });
  });
  $app.querySelectorAll('[data-select]').forEach((el) => {
    el.addEventListener('click', () => { state.selected = el.dataset.select; render(); });
  });

  const zone = $app.querySelector('[data-drop]');
  if (zone) bindDrop(zone);

  assertSingleRing();
}

function renderEmpty(L) {
  return `
    <section class="dropzone aurora-ring" data-drop style="min-height:280px">
      <div class="lamp lamp--live lamp--info"></div>
      <p>${esc(t(L, 'dropHint'))}</p>
      <p class="dropzone__hint">${esc(t(L, 'limitations'))}</p>
    </section>
  `;
}

function renderLoaded(L, d, inv) {
  return `
    <section class="bento">
      <article class="plug-card aurora-ring">
        <div class="plug-card__status"><span class="lamp lamp--ok"></span>${esc(t(L, 'entries'))}</div>
        <div class="readout">${readout(inv.entries)}</div>
        <div class="plug-card__body u-muted">${esc(d.dir)}</div>
      </article>
      <article class="plug-card">
        <div class="plug-card__status"><span class="lamp lamp--info"></span>${esc(t(L, 'files'))}</div>
        <div class="readout">${readout(inv.files)}</div>
        <div class="plug-card__body u-muted">${inv.dateRange ? `${inv.dateRange.from} → ${inv.dateRange.to}` : '—'}</div>
      </article>
      <article class="plug-card">
        <div class="plug-card__status"><span class="lamp lamp--warn"></span>${esc(t(L, 'tokens'))}</div>
        <div class="readout">${readout(inv.tokens)}</div>
        <div class="plug-card__body u-muted">${esc(t(L, 'tokenMethod'))}</div>
      </article>
      <article class="plug-card">
        <div class="plug-card__status"><span class="lamp lamp--danger"></span>${esc(t(L, 'clusters'))}</div>
        <div class="readout readout--warn">${readout(d.clusters.length)}</div>
        <div class="plug-card__body u-muted">${esc(t(L, 'elapsed'))}: ${d.timing?.dupesMs ?? '—'} ms</div>
      </article>
    </section>

    <nav class="row row--wrap" style="margin-top:var(--sp-5)">
      ${tab('inventory', t(L, 'inventoryView'))}
      ${tab('clusters', t(L, 'clusterView'))}
      ${tab('decay', t(L, 'decayView'))}
      ${tab('tree', t(L, 'treeView'))}
    </nav>

    ${state.view === 'inventory' ? viewInventory(L, d) : ''}
    ${state.view === 'clusters' ? viewClusters(L, d) : ''}
    ${state.view === 'decay' ? viewDecay(L, d) : ''}
    ${state.view === 'tree' ? viewTree(L, d) : ''}

    <p class="u-muted" style="margin-top:var(--sp-6)">${esc(t(L, 'limitations'))}</p>
  `;
}

function tab(id, label) {
  const on = state.view === id;
  return `<button class="btn btn--sm ${on ? 'btn--primary' : ''}" data-view="${id}">${esc(label)}</button>`;
}

function viewInventory(L, d) {
  const rows = (d.entries || []).slice(0, 200).map((e) => `
    <tr>
      <td class="u-mono">${esc(e.provenance)}</td>
      <td><span class="chip chip--ghost">${esc(e.section)}</span></td>
      <td>${esc((e.body || '').replace(/\s+/g, ' ').slice(0, 120))}</td>
    </tr>`).join('');
  return `
    <table class="table">
      <thead><tr><th>${esc(t(L, 'provenance'))}</th><th>${esc(t(L, 'sections'))}</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3">${esc(t(L, 'empty'))}</td></tr>`}</tbody>
    </table>`;
}

function viewClusters(L, d) {
  if (!d.clusters.length) return `<p class="empty">${esc(t(L, 'noClusters'))}</p>`;
  return `<div class="stack">${d.clusters.map((c, i) => `
    <article class="card">
      <div class="row row--between">
        <h3 style="margin:0">#${i + 1} · ${c.size}</h3>
        <span class="chip chip--warn">${esc(t(L, 'candidates'))}: ${c.candidates.length}</span>
      </div>
      <div class="grid grid--2" style="margin-top:var(--sp-3)">
        <div>
          <div class="u-caps">${esc(t(L, 'representative'))}</div>
          <p class="u-mono">${esc(c.representative.provenance)}</p>
          <div class="term">${esc(c.representative.body)}</div>
        </div>
        <div>
          <div class="u-caps">${esc(t(L, 'candidates'))}</div>
          ${c.candidates.map((x) => `
            <p class="u-mono">${esc(x.provenance)} <span class="chip">${c.scores[x.id] ?? ''}</span></p>
            <div class="term">${esc(x.body)}</div>
          `).join('')}
        </div>
      </div>
    </article>
  `).join('')}</div>`;
}

function viewDecay(L, d) {
  if (!d.decay.length) return `<p class="empty">${esc(t(L, 'noDecay'))}</p>`;
  const rows = d.decay.map((r) => `
    <tr>
      <td class="num">${r.score}</td>
      <td class="u-mono">${esc(r.provenance)}</td>
      <td>${(r.reasons || []).map((x) => `<span class="chip chip--${chipFor(x.code)}">${esc(reasonLabel(x.code))}: ${esc(x.detail)}</span>`).join(' ')}</td>
      <td>${esc((r.body || '').replace(/\s+/g, ' ').slice(0, 90))}</td>
    </tr>`).join('');
  return `
    <p class="u-muted">${esc(t(L, 'review'))}</p>
    <table class="table">
      <thead><tr><th>${esc(t(L, 'score'))}</th><th>${esc(t(L, 'provenance'))}</th><th>${esc(t(L, 'reasons'))}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function chipFor(code) {
  if (code === 'contradicted') return 'danger';
  if (code === 'duplicateOf') return 'warn';
  if (code === 'pastDate') return 'info';
  return 'ghost';
}

function viewTree(L, d) {
  const secs = d.inventory.sections || [];
  const max = Math.max(1, ...secs.map((s) => s.entries));
  return `
    <div class="stack">
      ${secs.map((s) => {
        const pct = Math.round((s.entries / max) * 100);
        return `
          <div>
            <div class="row row--between">
              <span>${esc(s.section)}</span>
              <span class="u-mono">${s.entries} · ${s.tokens} tok</span>
            </div>
            <div class="spark" style="height:18px">
              <span class="spark__bar spark__bar--peak" style="--v:${pct};width:${pct}%;max-width:100%"></span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function bindDrop(zone) {
  const on = (e) => { e.preventDefault(); zone.classList.add('is-over'); };
  const off = (e) => { e.preventDefault(); zone.classList.remove('is-over'); };
  zone.addEventListener('dragenter', on);
  zone.addEventListener('dragover', on);
  zone.addEventListener('dragleave', off);
  zone.addEventListener('drop', async (e) => {
    off(e);
    try {
      await loadFiles(e.dataTransfer.files);
    } catch (err) {
      toast(String(err.message || err), 'danger');
    }
  });
}

function boot() {
  initAuroraUI({
    commands: [
      { id: 'open-json', label: 'Open JSON export / 打开 JSON', hint: '⌘O', group: 'File', run: () => document.getElementById('file-json')?.click() },
      { id: 'open-dir', label: 'Open memory folder / 打开目录', group: 'File', run: () => document.getElementById('file-dir')?.click() },
      { id: 'view-inv', label: 'Inventory / 清单', group: 'View', run: () => { state.view = 'inventory'; render(); } },
      { id: 'view-dup', label: 'Duplicates / 重复簇', group: 'View', run: () => { state.view = 'clusters'; render(); } },
      { id: 'view-dec', label: 'Decay / 衰减', group: 'View', run: () => { state.view = 'decay'; render(); } },
      { id: 'view-tree', label: 'Treemap / 树图', group: 'View', run: () => { state.view = 'tree'; render(); } },
      { id: 'lang', label: 'Toggle language / 切换语言', group: 'App', run: () => setLang(state.lang === 'en' ? 'zh' : 'en') },
    ],
  });
  render();
}

boot();
