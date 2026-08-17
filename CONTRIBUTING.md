# Contributing to Memory Lens

Thanks for helping. This tool edits people’s long-term agent memory, so the bar is “boring and unbreakable” rather than clever.

## Running tests

```bash
npm test          # node --test test/*.test.js — no build step, no dependencies
```

Use the shell glob `test/*.test.js`. `node --test` only gained glob expansion in Node 21, and pointing it at a directory will also try to execute helper files.

All tests must pass before a PR is merged. CI runs the same command on Node 20 and 22.

There is a synthetic fixture generator in `test/fixtures.js`. **Do not check in, or test against, anyone’s real memory directory.**

## The most welcome PRs

**Better decay signals that stay honest.** A new heuristic is welcome if:

1. You can justify it in a comment (what it measures, what it cannot see).
2. It never promotes a review list into a delete list.
3. There is a fixture that would have been missed without it, and one that must *not* fire.

**Parser improvements** for messy markdown (nested lists, definition lists, frontmatter). Every new shape needs a provenance test: `file#line` still has to land on the line a human would edit.

**Viewer polish** that still obeys the five aurora-ui laws — especially *one* `.aurora-ring` on screen.

## Non-negotiables

- **Zero runtime dependencies.** Node built-ins only. Node ≥ 18.
- **Zero telemetry.** No analytics, no accounts, no phone-home.
- **Never mutate without a backup + explicit confirmation.** Dry-run is the default. Tests must keep proving this.
- **Never delete from decay.** Decay ranks; a human decides. `prune` only removes duplicate *candidates*.
- **Bilingual.** User-facing strings go in `src/i18n.js` (EN + 中文).
- **Do not add an embedding model** unless it is fully optional, fully offline, and cannot override the lexical badges. The README’s honesty section is a feature.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/): `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`.

If your change implements a task from the suite roadmap, put the task ID in the commit body:

```
feat(dupes): raise LSH band count for CJK-heavy corpora

Task: N3
```

## Pull request checklist

- [ ] `npm test` passes
- [ ] New behaviour has a synthetic fixture
- [ ] Safety properties still hold (dry-run / backup-first)
- [ ] User-facing strings are bilingual
- [ ] README limitations updated if the honesty boundary moved

## Licence

By contributing, you agree that your contribution is licensed under the [MIT Licence](./LICENSE).
