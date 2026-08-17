# 🔎 Memory Lens

> **You cannot trust an agent’s memory you have never read.**

[![CI](https://github.com/Zijian-Ni/memory-lens/actions/workflows/test.yml/badge.svg)](https://github.com/Zijian-Ni/memory-lens/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Zero deps](https://img.shields.io/badge/deps-zero-violet.svg)](package.json)
[![Zero telemetry](https://img.shields.io/badge/telemetry-zero-green.svg)](README.md)

A local-first inspector for the pile of markdown an agent accumulates: `MEMORY.md`, daily notes, distilled “lessons”, preference records. Over months the same lesson is written five times in slightly different words, stale facts contradict current ones, and nobody can see what the agent actually believes.

Memory Lens gives a *human* a way to inventory that pile, cluster near-duplicates, rank stale entries for review, and prune — with a backup and an audit report — only when you say so.

**Part of the [Aurora Evidence Suite](https://github.com/Zijian-Ni/aurora-evidence-suite)** — local-first evidence tools for AI agents.

MIT · 中英双语 · zero telemetry · no backend, no API key.

---

## 30-second Quickstart

```bash
git clone https://github.com/Zijian-Ni/memory-lens.git
cd memory-lens

# Point this at any folder of markdown. Nothing is uploaded.
node src/cli.js inventory ./path/to/memory
node src/cli.js dupes     ./path/to/memory
node src/cli.js decay     ./path/to/memory

# Dry-run first. --apply is the only mutating switch, and it still asks.
node src/cli.js prune     ./path/to/memory
node src/cli.js prune     ./path/to/memory --apply

# Open the static viewer (no server required if your browser allows file://
# module loads; otherwise any static server).
# Drop a `memory-lens.json` from `export`, or a folder of .md files.
node src/cli.js export    ./path/to/memory --out memory-lens.json
```

Or `npx memory-lens inventory .` once published.

Open `index.html` in a browser, drop the JSON (or a directory of `.md` files), and browse duplicate clusters side by side, the decay ranking, and a section treemap. **Zero backend.**

---

## Commands

| Command | Mutates? | What it does |
|---|---|---|
| `inventory <dir>` | no | Walk markdown, parse heading- and bullet-scoped *entries*, report files / entries / approx. tokens / date range / top-level sections. Every entry carries `file#line` provenance. |
| `dupes <dir>` | no | Near-duplicate clusters via character 3-gram Jaccard + MinHash/LSH banding. Picks a representative (newest, then longest). The rest are removal *candidates*. |
| `decay <dir>` | no | Rank entries a human should re-read. **Never a delete list.** |
| `prune <dir>` | only with `--apply` | Remove duplicate candidates. Default is dry-run. Requires `--apply` **and** typing `prune` (or `--yes`). Writes a timestamped backup of every touched file *first*, then `memory-lens-report.md`. |
| `export <dir>` | writes JSON only | Bundle inventory + clusters + decay for the static viewer. |

Token estimate method: **each CJK character counts as 1; remaining text is split on whitespace and punctuation.** It is not a model tokenizer. The number is an order of magnitude so you can see whether the pile is 2k or 200k tokens.

---

## Honest limitations

Say these out loud before you trust a ranking:

- **Similarity is lexical, not semantic.** Character 3-gram Jaccard will catch “edit openclaw.json directly” written four ways. It will **not** notice that “prefer Opus” and “use the expensive model” mean the same thing. There is no embedding model and no network call, on purpose.
- **Decay scoring is a heuristic.** Age, a later negation/number clash on overlapping text, being a near-duplicate of a newer entry, and ISO dates now in the past. It does not reason. A high score means “a human should look”, not “delete this”.
- **Prune only removes duplicate candidates**, never decay hits. Stale-but-unique facts stay until a person edits them.
- **Provenance is a line range, not an AST.** Nested lists and multi-paragraph bullets are best-effort. If an entry cannot be located, it cannot be fixed — that is why every row prints `file#line`.

---

## Safety

This tool touches someone’s memory. A data-loss bug here is unforgivable.

- Default is dry-run. `prune` without `--apply` writes nothing.
- `--apply` still requires an interactive `prune` confirmation, or `--yes` for CI.
- Every touched file is copied to `_memory-lens-backups/<stamp>/` **before** any edit.
- `memory-lens-report.md` records exactly what was removed and from where.
- Tests assert dry-run does not mutate, abort-without-confirm does not mutate, and backups equal the original bytes.

---

## Why character 3-grams

CJK has no whitespace. A word-shingle pipeline would collapse every Chinese sentence into one giant token and miss the 三字片段 that actually repeat. Latin still produces useful overlapping trigrams. MinHash + banding is a prefilter so 10k entries do not degrade to a full O(n²) sweep; pairs that share a band are then compared with exact Jaccard.

---

## 中文说明

**Memory Lens 让人能读、能剪 Agent 的长期记忆。**

跑得久的 Agent 会堆出 `MEMORY.md`、每日笔记、提炼过的「教训」和偏好记录。几个月后同一条教训被用稍有不同的措辞写五遍，过期事实和新事实互相打架，谁也说不清这个 Agent 到底「相信」什么。

Memory Lens 的立场是：**你从未读过的 Agent 记忆，不值得信任。**

- `inventory` 把目录拆成带 `文件#行号` 出处的条目
- `dupes` 用字 3-gram 的 Jaccard + MinHash 预过滤找近重复（**不做向量、不联网**）
- `decay` 按年龄 / 被后来条目反驳 / 与更新条目重复 / 过期日期打分，输出「请复核」列表，**永远不是删除清单**
- `prune --apply` 是唯一会改文件的命令：先写带时间戳的备份，再改，并留下 `memory-lens-report.md` 审计

**诚实的边界**：相似度是字面的，不是语义的——换一种说法就会漏。衰减分是启发式，不是判决。零遥测、无后端、不需要 API key。

**Aurora Evidence Suite 的一部分。** MIT 许可。

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Tests: `npm test` (`node --test test/*.test.js` — the glob form, so Node 20 works).

## License

MIT © Zijian Ni
