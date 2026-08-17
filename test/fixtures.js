import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Synthetic memory tree. Tests must never depend on a real workspace.
 *
 * Shape mirrors an OpenClaw-style memory dir (MEMORY.md + daily files +
 * dreaming drafts) without copying anyone's private notes.
 */
export function writeSyntheticMemory(root, opts = {}) {
  const dir = root || fs.mkdtempSync(path.join(os.tmpdir(), 'memory-lens-'));
  fs.mkdirSync(path.join(dir, 'memory', 'dreaming', 'light'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'memory', 'dreaming', 'deep'), { recursive: true });

  const memoryMd = `# Preferences 偏好

- Prefer local-first tools. Never send memory to a hosted API.
- 偏好本地优先的工具，记忆不要送到托管 API。

# Lessons 教训

- ExtraPaths is protected by a guardrail; edit openclaw.json directly.
- extraPaths 受护栏保护，要改就直接编辑 openclaw.json。
- Always backup openclaw.json before an upgrade.

# People

- Current live name is 兮崽崽er (room 30313460).
`;

  const dayOld = `# 2026-03-01

## Lessons 教训

- ExtraPaths is protected by a guardrail; edit openclaw.json directly.
- The live name is 恋恋小兮ya.

## Numbers

- Disk F is at 62% used.
- Tests do not pass on Node 18.
`;

  const dayNew = `# 2026-07-25

## Lessons 教训

- ExtraPaths is protected by a guardrail — edit openclaw.json directly instead.
- Current live name is 兮崽崽er, not 恋恋小兮ya.

## Numbers

- Disk F is at 96% used.
- Tests pass on Node 18.

## Dated

- Visa appointment was 2024-11-02.
`;

  const distinct = `# Distinct topics

- The Japanese itinerary starts in Osaka then Kyoto then Tokyo.
- Claude Opus 4.7 pricing must be fetched live, never recited from MEMORY.md.
- Heartbeat should stay silent between 23:00 and 08:00 unless L1.
`;

  const dream = `# light draft 2026-07-20

- ExtraPaths is protected by a guardrail; edit openclaw.json directly.
`;

  fs.writeFileSync(path.join(dir, 'MEMORY.md'), memoryMd);
  fs.writeFileSync(path.join(dir, 'memory', '2026-03-01.md'), dayOld);
  fs.writeFileSync(path.join(dir, 'memory', '2026-07-25.md'), dayNew);
  fs.writeFileSync(path.join(dir, 'memory', 'notes-travel.md'), distinct);
  fs.writeFileSync(path.join(dir, 'memory', 'dreaming', 'light', '2026-07-20.md'), dream);

  if (opts.large) {
    const n = opts.large;
    const largeDir = path.join(dir, 'memory', 'synth');
    fs.mkdirSync(largeDir, { recursive: true });
    const topics = [
      'Always write a backup before touching openclaw.json.',
      'Prefer sonnet for heartbeat; never spend opus on cron.',
      'F 盘影视资源已经占了 3.4TB，超过 85% 就要告警。',
      '日本行程：先大阪，再京都，最后东京。',
      'Session compaction over 100k tokens should prompt /session new.',
    ];
    for (let i = 0; i < n; i++) {
      const day = 1 + (i % 28);
      const month = 1 + (i % 12);
      const date = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const topic = topics[i % topics.length];
      const variant = i % 7 === 0 ? topic : `${topic} (${i}) unique-salt-${i} ${'x'.repeat((i % 5) + 1)}`;
      const extra = `# ${date}\n\n## Synth ${i % 5}\n\n- ${variant}\n- Unrelated fact ${i}: latitude ${i % 90}.\n`;
      fs.writeFileSync(path.join(largeDir, `${date}-${i}.md`), extra);
    }
  }

  return dir;
}

export function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
