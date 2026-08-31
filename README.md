# FlagDeck

FlagDeck is a feature-flag workbench by **Saeed Rumaneh**. Boolean flags, percentage rollouts, a hard kill switch, deterministic evaluation from a user key, and an append-only change audit — backed by JSON on disk and Next.js route handlers.

## Why it exists

Operators need three guarantees that many ad-hoc `if` toggles lack:

1. **Determinism** — the same user key always lands in the same rollout bucket.
2. **Kill switch** — a single control that forces `false` even when a flag is “on” at 100%.
3. **Auditability** — every toggle, rollout change, and kill event leaves a trail.

## Capabilities

- Boolean on/off flags
- Percentage rollout (0–100) with hash-modulo bucketing
- Kill switch that overrides enablement and percentage
- Live evaluation against any user key (client `evaluateFlag` on API-loaded flags)
- Persisted audit log of flag mutations

## Persistence & API

State lives in `data/flags.json` (`{ flags, audit }`, gitignored).

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/flags` | Load flags + audit |
| PUT | `/api/flags` | Save flags + audit |
| POST | `/api/flags/create` | Create flag `{ key, name, kind, percentage }` |
| POST | `/api/flags/:id/evaluate` | Body `{ userKey }` → evaluation result |
| POST | `/api/flags/:id/kill-switch` | Toggle kill switch and append audit |

## Complete product flows

1. Create a percentage flag (key, name, kind, rollout %) — it appears in the signal yard and audit.
2. Enter a user key, enable the flag, and watch bucket + ENABLED/DISABLED update live.
3. Engage the kill switch — evaluation forces false and the change persists in `data/flags.json`.

## Evaluation model

```text
user key ──► FNV-1a hash ──► bucket = hash % 100
                                  │
flag config ──────────────────────┼──► enabled?
  • killSwitch → always false
  • disabled   → false
  • boolean    → true when enabled
  • percentage → true when bucket < percentage
```

Core logic lives in `lib/flags.ts` and is covered by Vitest.

## Development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Change a flag, restart the server — state is still in `data/flags.json`.

```bash
npm test
npm run typecheck
npm run build
```

## Security posture

FlagDeck is a demonstration. See [SECURITY.md](SECURITY.md).

## License

MIT © 2026 Saeed Rumaneh
