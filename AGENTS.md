# StageGate — agent contract

Rules for Cursor agents (and any autonomous runner) working in this repo without human supervision.

## Ship loop (task → commit → push)

When the task includes **ship**, **deploy**, **commit**, **push**, or **merge to main**:

1. Make the code change.
2. Gate with `pnpm agent:check` (and scoped tests if you touched logic).
3. Commit with a concise message (HEREDOC).
4. `git push` to the tracking branch (usually `main`). Deploy is **git push → Railway + Vercel** — do not drive interactive `railway` / `vercel` CLIs unless non-interactive flags are confirmed.

If the task does **not** mention ship/commit/push, leave the working tree uncommitted.

Never: force-push `main`/`master`, `--no-verify`, amend pushed commits, or commit `.env` / secrets.

## Fast gates (prefer these)

| Command | Use |
|---------|-----|
| `pnpm agent:check` | Typecheck only — default pre-push gate |
| `pnpm test:unit -- path/to/file.test.ts` | Scoped tests for changed logic |
| `pnpm test` | Full suite — only when the task asks or a wide refactor needs it |
| `pnpm format` | Avoid in agent loops (whole-tree rewrite, noisy diffs) |

## Ops scripts (not part of the ship loop)

Batch enrich / draft / discovery scripts are **slow** and must stay out of commit/push turns.

- Always pass `--limit` (defaults are small; max capped).
- They use fetch timeouts + wall-clock exit (`AGENT_WALL_MS` or `--timeout-ms`).
- Prefer production crons / Admin UI over local batch scripts unless the task is explicitly ops.

Examples:

```bash
node scripts/run-generate-drafts.mjs --limit 10
node scripts/run-partner-enrichment.mjs --limit 10
node scripts/sync-rfr-prospects.mjs --timeout-ms 60000
pnpm agent:hunter -- 20
```

## Performance defaults

- Shell commands: set an explicit timeout; never leave unbounded `fetch`/LLM loops.
- Prefer reading files / grepping over launching long explorers.
- Do not start `pnpm dev` or other watchers inside a ship task.
- Parallelize independent reads; serialize writes to git.

## Product agents (runtime, not Cursor)

Labeled product agents (Relay, Cal, Max, Natasha, Ted) live in `docs/ai-org.md` and `server/agents/`. They do not commit code. Cursor agents that change product-agent code still follow the ship loop above.
