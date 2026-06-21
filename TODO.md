# Notion-DeMark — Outstanding Tasks

## Project Context

Daily TD DeMark signal engine for a personal US stock portfolio.

- **Runtime:** Node/TypeScript on Vercel — main entry point is `api/daily.ts`
- **Data flow:** Notion Lots DB → Tiingo (300-day OHLCV) → `computeSetup` / `computeCountdown` / `computeTDST` / `computeATR` → Notion Daily Signals DB → Discord webhook
- **Cron:** cron-job.org fires `POST /api/daily` at `0 22 * * 1-5` UTC (10AM NZT Tue–Sat)
- **Auth:** `Authorization: Bearer $CRON_SECRET` header required on all `/api/*` routes
- **Tests:** Jest 30 + ts-jest — run `npm test`. Currently 39/39 passing.
- **Key files:**
  - `src/types/index.ts` — all shared interfaces (`TickerSignal`, `Bar`, `PrevSnapshot`, etc.)
  - `src/lib/demark.ts` — all computation functions
  - `src/lib/discord.ts` — `postAlerts` + `postSummary`
  - `src/lib/notion.ts` — `getLots` + `insertDailySignal`
  - `src/lib/demark.test.ts` — unit tests
  - `api/daily.ts` — Vercel handler (orchestrates everything)

### Completed features (do not re-implement)
- TD Setup 9, Countdown 13, TDST levels, TDST distance/status
- EMA20/EMA50 trend classification (`classifyTrend`)
- Signal strength score (0–100), reversal probability (0–1 logistic)
- `SignalDelta` — daily change detection (setup/countdown/trend/tdst changes)
- `PrevSnapshot` — yesterday's computed state for alert deduplication
- `computeAlerts` — 8 transition-based alert rules (fires only on state change)
- `computeATR(14)` with Wilder smoothing + `classifyVolatility` (low/normal/high)
- Discord: `postAlerts` (consolidated alert block) + `postSummary` (per-ticker detail)

---

## ~~Task 1 — Portfolio Summary Header~~ ✓ DONE (2026-06-20)

**Start new session:** Yes — isolated change to `discord.ts` only.

Add a header line to the daily Discord summary showing portfolio-level stats before the per-ticker blocks.

**What to build:**
- In `postSummary`, compute across all signals before building per-ticker lines:
  - Total weighted PnL% (weight by avgCost × quantity, or just average pnlPct if quantity isn't on `TickerSignal`)
  - Ticker with highest signal strength (name + score)
  - Ticker with lowest signal strength (name + score)
- Prepend a header block to the Discord message, e.g.:
  ```
  US Portfolio – DeMark Daily
  Portfolio PnL: +4.2% | Top signal: NVDA (82/100) | Weakest: AAPL (18/100)
  ```

**Notes:**
- `TickerSignal` does not carry `quantity` — use simple average of `pnlPct` across tickers unless you add quantity to the signal.
- No new files needed; only `src/lib/discord.ts` changes.
- No new tests needed (Discord output is not unit-tested).

---

## ~~Task 2 — Notion Schema Extensions~~ ✓ DONE (2026-06-20)

**Start new session:** No — group with Task 1 (same session, small change).

Persist `atrPct` and `volatility` into the Notion Daily Signals DB so historical volatility is queryable.

**What to build:**
- In `src/lib/notion.ts`, add two properties to the `insertDailySignal` call:
  - `ATR %` → `number` (store `signal.atrPct`, rounded to 2dp)
  - `Volatility` → `select` (store `signal.volatility` — `'low'` / `'normal'` / `'high'`)
- Add the two columns to the Notion Daily Signals DB manually before running (Notion API can't create schema columns — the properties must exist first).

**Notes:**
- Check `src/lib/notion.ts` `insertDailySignal` for the existing property mapping pattern.
- Notion `select` property takes `{ select: { name: value } }` syntax.
- The DB property names in Notion must match exactly what the code sends.

---

## ~~Task 3 — Weekly Summary Engine~~ ✓ DONE (2026-06-20)

**Start new session:** Yes — new endpoint, new file, self-contained.

Add `/api/weekly` — a separate Vercel handler that queries the last 5 trading days of signals from Notion and posts a weekly recap to Discord.

**What to build:**
- New file: `api/weekly.ts` (same auth pattern as `api/daily.ts` — Bearer `CRON_SECRET`)
- Query Notion Daily Signals DB for the last 5 days of records (filter by date, sorted descending)
- Aggregate per ticker: PnL trend, signal direction trend, whether any alerts fired
- Post a Discord message: one block per ticker showing the week's arc, e.g.:
  ```
  NVDA: Sell Setup 5→7, Countdown 0→3, PnL -1.2% → +0.8%  [High vol]
  ```
- Wire up a new cron on cron-job.org: `0 22 * * 5` UTC (Friday) → `POST /api/weekly`

**Notes:**
- Notion Daily Signals DB stores `Date` as the **title property** (not a date field) — filter by title prefix or store an actual date field.
- Notion query API: `client.databases.query({ database_id, filter, sorts })`.
- The existing `getLots` in `notion.ts` is a good pattern reference.
- Add Bearer auth header check — same as `api/daily.ts:10`.
- No unit tests expected unless the aggregation logic is complex enough to warrant it.

---

## ~~Task 4 — Backfill Mode~~ ✓ DONE (2026-06-20)

**Start new session:** Yes — new endpoint, self-contained.

Add `/api/backfill?days=N` to replay the daily pipeline for the last N trading days without firing Discord alerts.

**What to build:**
- New file: `api/backfill.ts` (same auth pattern)
- Accept `?days=N` query param (default 5, max 30)
- For each of the last N trading days (skip weekends):
  - Slice `bars` to simulate the view as of that date (`bars.slice(0, endIndex)`)
  - Compute full signal (setup, countdown, TDST, ATR, etc.)
  - Call `insertDailySignal` — but skip `postAlerts` and `postSummary`
- Return a JSON summary of what was inserted

**Notes:**
- Tiingo returns the full 300-day history — slicing by index is enough; no extra API calls needed.
- Trading day calculation: subtract calendar days, skip Sat/Sun (no holiday awareness needed for MVP).
- Backfill overwrites existing Notion records for the same ticker+date, or inserts new ones — check `insertDailySignal` behaviour; it may need an upsert variant.
- No unit tests needed unless trading-day logic is extracted.

---

## ~~Task 5 — DeMark Engine v4 Refactor~~ ✓ DONE (2026-06-20)

**Start new session:** Yes — refactor of `demark.ts`, high test-coverage requirement.

Consolidate all per-ticker computation into a single exported function `computeSignal(bars, lots)` that returns a `TickerSignal`.

**What to build:**
- Add `computeSignal(bars: Bar[], lots: Lot[]): TickerSignal` to `src/lib/demark.ts`
- Internalize: `computeSetup`, `computeCountdown`, `computeTDST`, `computeTDSTDistance`, `ema`, `classifyTrend`, `computeSignalStrength`, `computeReversalProbability`, `computeATR`, `classifyVolatility`
- The function should also compute `delta` and `prevSnapshot` internally (currently done inline in `api/daily.ts`)
- `api/daily.ts` loop body shrinks to: `getHistory` → `computeSignal` → `insertDailySignal` → `computeAlerts`
- Keep all individual functions exported (they're unit-tested and may be useful standalone)

**Notes:**
- `computeAvgCost` lives in `src/utils/groupLots.ts`, not `demark.ts` — import it.
- The `summary` field on `TickerSignal` is currently always `''` — leave it that way.
- Tests must pass before and after. Run `npm test` at both ends.
- This is a refactor — behaviour must not change. Diff `api/daily.ts` before/after to confirm nothing was dropped.

---

## Recommended Session Order

| # | Task | Session | Effort |
|---|------|---------|--------|
| 1 | ~~Portfolio Summary Header + Notion Schema Extensions~~ | ✓ DONE | 2026-06-20 |
| 2 | ~~Weekly Summary Engine~~ | ✓ DONE | 2026-06-20 |
| 3 | ~~Backfill Mode~~ | ✓ DONE | 2026-06-20 |
| 4 | ~~DeMark Engine v4 Refactor~~ | ✓ DONE | 2026-06-20 |
