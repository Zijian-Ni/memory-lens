# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-08-17

### Added

- `inventory` — walk a memory directory into heading- and bullet-scoped entries with `file#line` provenance, token estimate, date range and section breakdown.
- `dupes` — character 3-gram Jaccard near-duplicate clustering with MinHash / LSH banding. No embeddings, no network.
- `decay` — heuristic staleness ranking (age, later negation/number clash, newer duplicate, past ISO dates). Review list only.
- `prune` — the only mutating command. Dry-run by default; `--apply` plus confirmation; timestamped backups first; `memory-lens-report.md` audit trail.
- `export` + static viewer (`index.html`) vendoring aurora-ui. Drag a JSON export or a folder of markdown.
- Synthetic fixture generator and `node --test` coverage for provenance, clustering, CJK, and prune safety.

_Zero runtime dependencies. MIT._
