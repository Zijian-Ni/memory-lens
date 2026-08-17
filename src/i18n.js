/** Bilingual user-facing strings. CLI and viewer share this table. */

export const STRINGS = {
  en: {
    name: 'Memory Lens',
    tagline: 'You cannot trust an agent’s memory you have never read.',
    usage: `memory-lens — inspect and prune long-lived agent memory

Usage:
  memory-lens inventory <dir> [--json]
  memory-lens dupes     <dir> [--json] [--threshold 0.55]
  memory-lens decay     <dir> [--json]
  memory-lens prune     <dir> [--apply] [--yes]
  memory-lens export    <dir> [--out memory-lens.json]

Flags:
  --json          Machine-readable output
  --threshold N   Jaccard threshold for near-duplicates (default 0.55)
  --apply         Actually write (prune only). Default is dry-run.
  --yes           Skip the interactive prompt. Still requires --apply.
  --out FILE      Export path (default: ./memory-lens.json)
  --lang en|zh    Language for human-readable output
  -h, --help      Show this help

Safety: prune never edits a file without first writing a timestamped
backup. Decay ranks for review — it is never a delete list.`,
    files: 'Files',
    entries: 'Entries',
    tokens: 'Tokens (approx.)',
    tokenMethod: 'CJK chars + whitespace-delimited Latin tokens. Not a model tokenizer.',
    dateRange: 'Date range',
    sections: 'Top-level sections',
    clusters: 'Duplicate clusters',
    candidates: 'Removal candidates',
    representative: 'Keep (representative)',
    review: 'Review these (not a delete list)',
    dryRun: 'Dry-run — no files written.',
    applyNeedConfirm: 'Type prune to confirm editing {n} file(s). Backups are written first: ',
    aborted: 'Aborted. Nothing was written.',
    needApply: 'Refusing to mutate: pass --apply AND confirm (or --yes).',
    needTty: 'No TTY. Re-run with --apply --yes after reading the dry-run plan.',
    backedUp: 'Backed up',
    removed: 'Removed',
    reportWritten: 'Wrote audit report',
    dropHint: 'Drop a memory-lens.json export, or a folder of .md files. Nothing leaves this browser.',
    loadJson: 'Open JSON export',
    loadDir: 'Open memory folder',
    theme: 'Theme',
    lang: 'Language',
    empty: 'Nothing loaded yet.',
    clusterView: 'Duplicate clusters',
    decayView: 'Decay ranking',
    treeView: 'Section treemap',
    inventoryView: 'Inventory',
    limitations: 'Lexical similarity only — paraphrases will be missed. Decay is a heuristic, not a verdict.',
    noClusters: 'No near-duplicates above the threshold.',
    noDecay: 'Nothing scored as stale.',
    provenance: 'Provenance',
    score: 'Score',
    reasons: 'Why',
    age: 'age',
    contradicted: 'contradicted by a later entry',
    duplicateOf: 'duplicate of a newer entry',
    pastDate: 'mentions a date now in the past',
    elapsed: 'dupes wall time',
  },
  zh: {
    name: 'Memory Lens · 记忆透镜',
    tagline: '你从未读过的 Agent 记忆，不值得信任。',
    usage: `memory-lens — 检视并清理长期积累的 Agent 记忆

用法：
  memory-lens inventory <dir> [--json]
  memory-lens dupes     <dir> [--json] [--threshold 0.55]
  memory-lens decay     <dir> [--json]
  memory-lens prune     <dir> [--apply] [--yes]
  memory-lens export    <dir> [--out memory-lens.json]

参数：
  --json          机器可读输出
  --threshold N   近重复的 Jaccard 阈值（默认 0.55）
  --apply         真正写入（仅 prune）。默认是 dry-run。
  --yes           跳过交互确认。仍然必须带 --apply。
  --out FILE      导出路径（默认 ./memory-lens.json）
  --lang en|zh    人类可读输出的语言
  -h, --help      显示帮助

安全：prune 在改任何文件之前，都会先写一份带时间戳的备份。
decay 只做「请你复核」排序，永远不是删除清单。`,
    files: '文件数',
    entries: '条目数',
    tokens: '约计 token',
    tokenMethod: 'CJK 按字计 1 token，拉丁按空白分词。不是模型分词器。',
    dateRange: '日期范围',
    sections: '顶级章节',
    clusters: '重复簇',
    candidates: '可考虑删除的候选',
    representative: '保留（代表条）',
    review: '请复核（不是删除清单）',
    dryRun: '演练模式 — 没有写入任何文件。',
    applyNeedConfirm: '将编辑 {n} 个文件。备份会先写好。输入 prune 确认：',
    aborted: '已中止。什么都没写。',
    needApply: '拒绝改写：必须同时提供 --apply 并且确认（或 --yes）。',
    needTty: '没有 TTY。请先看 dry-run 计划，再加 --apply --yes。',
    backedUp: '已备份',
    removed: '已移除',
    reportWritten: '已写入审计报告',
    dropHint: '把 memory-lens.json 或一整个 .md 目录拖进来。数据不会离开这台浏览器。',
    loadJson: '打开 JSON 导出',
    loadDir: '打开记忆目录',
    theme: '主题',
    lang: '语言',
    empty: '还没有加载内容。',
    clusterView: '重复簇',
    decayView: '衰减排序',
    treeView: '章节树图',
    inventoryView: '清单',
    limitations: '相似度是字面的，不是语义的——换一种说法就会漏。衰减分是启发式，不是判决。',
    noClusters: '没有超过阈值的近重复。',
    noDecay: '没有被标成陈旧的条目。',
    provenance: '出处',
    score: '分数',
    reasons: '原因',
    age: '年龄',
    contradicted: '被更晚的条目反驳',
    duplicateOf: '与更新的条目重复',
    pastDate: '提到了一个已经过去的日期',
    elapsed: 'dupes 墙钟时间',
  },
};

export function detectLang(explicit, env = {}) {
  if (explicit === 'zh' || explicit === 'en') return explicit;
  const raw = String(
    env.MEMORY_LENS_LANG || env.LANG || env.LC_ALL || env.language || env.userLanguage || 'en',
  ).toLowerCase();
  return raw.startsWith('zh') ? 'zh' : 'en';
}

export function t(lang, key, vars = {}) {
  const table = STRINGS[lang] || STRINGS.en;
  let s = table[key] ?? STRINGS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
