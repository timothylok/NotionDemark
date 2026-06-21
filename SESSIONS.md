# Session Log

## 2026-06-18 (session 1)
- Initialized CLAUDE.md with behavioral guidelines
- Removed intra-file redundancies (duplicate "prefer editing existing files" bullet, inline lesson callouts already captured in §10)
- Filled in memory paths and session log configuration
- Built full DeMark engine: Notion lots → Tiingo prices → TD Setup/Countdown → Notion Daily DB → Discord webhook → Vercel `/api/daily`
- Scaffolded project: TypeScript, @notionhq/client, yahoo-finance2 (pinned 2.11.3), Tiingo (switched from Yahoo Finance and Alpha Vantage due to Vercel IP blocks/rate limits)
- Fixed Notion property mapping: Ticker as select, Date as title property, Buy Price as total invested (not per-share)
- Added Bearer token auth via CRON_SECRET env var
- Configured cron-job.org: `0 22 * * 1-5` UTC (= 10AM NZT Tue–Sat)
- Deployed to https://notion-demark.vercel.app — endpoint live and verified

## 2026-06-18 (session 2)
- Added Risk Alerts: `PrevSnapshot`, `computeAlerts` (8 transition-based rules), `postAlerts` in discord.ts — 33/33 tests
- Added ATR% / Volatility Regime: `computeATR(14)` Wilder smoothing, `classifyVolatility`, `atrPct`/`volatility` on `TickerSignal`, volatility bullet in Discord summary — 39/39 tests
- Created TODO.md with context and 4 remaining sessions (Portfolio Header + Notion Schema, Weekly Summary, Backfill Mode, v4 Refactor)
- Next: Portfolio Summary Header + Notion Schema Extensions (one session)

## 2026-06-20 (session 1)
- Added portfolio summary header to `postSummary` in `discord.ts`: avg PnL%, top/weakest signal strength ticker prepended before per-ticker blocks
- Added `ATR %` (number) and `Volatility` (select) to `insertDailySignal` in `notion.ts` — Notion columns added manually first
- Diagnosed and resolved production 500: Notion column was created as `ART %` (typo) — renamed to `ATR %` fixed it
- Note: `TIINGO_API_KEY` is Vercel-only env var, not in local `.env` — local full-pipeline runs fail at `getHistory`
- Verified: `POST /api/daily` → 200 OK end-to-end
- Next: Weekly Summary Engine (`api/weekly.ts`)

## 2026-06-20 (session 2)
- Added `api/weekly.ts`: queries Notion Daily DB for last 5 trading days via `filter.or` on title property, aggregates first→last arc per ticker (setup direction/count, countdown, PnL, volatility), posts single Discord message
- Verified live: `POST /api/weekly` → 200 OK, 5 tickers, 5 days
- Initial Discord output showed identical first→last values — expected, only 1 Notion record existed per ticker at that point (no prior daily cron history)
- Next: Backfill Mode (`api/backfill.ts`)

## 2026-06-20 (session 3)
- Added `api/backfill.ts`: `POST /api/backfill?days=N` (default 5, max 30), replays last N trading days into Notion without Discord alerts
- Slices Tiingo bars per historical date (`bars.slice(0, i+1)`) — one Tiingo call per ticker, no extra calls per day
- Upserts each record (query by title → update if exists, create if not) so re-running is safe
- Verified: 25 records written (4 inserted + 1 updated per ticker) — the 1 update was today's record from the earlier `/api/daily` trigger
- Re-ran `/api/weekly` after backfill — Discord now shows proper week arcs with real data
- Remaining: DeMark Engine v4 Refactor (`computeSignal` consolidation)

## 2026-06-20 (session 4)
- Added `computeSignal(bars, lots)` to `src/lib/demark.ts`: internalizes all per-ticker computation (setup, countdown, TDST, EMA, ATR, signal strength, reversal probability, delta, prevSnapshot), returns `{ signal, prevSnapshot }`
- Slimmed `api/daily.ts` loop from ~80 lines to 5; imports reduced from 12 symbols to 4
- All individual functions remain exported and unit-tested — behaviour unchanged
- Verified: 39/39 tests before and after, `POST /api/daily` → 200 OK end-to-end
- All 4 TODO sessions complete
- Fixed setup count display: capped at 9 in `computeSetup` result (`Math.min(..., 9)`) — was showing 11/9 for MSFT after a completed setup kept incrementing

## 2026-06-20 (session 5)
- Added Next.js 16 dashboard to the same repo: `app/dashboard/page.tsx` (SSG, force-static, deploy-hook freshness)
- Migrated API handlers from `api/` → `pages/api/` (VercelRequest/VercelResponse → NextApiRequest/NextApiResponse, zero logic changes)
- Extended `insertDailySignal()` and `upsertSignal()` (backfill) with 6 new Notion fields: Trend, Setup Direction, Setup Count, Signal Strength, TDST Distance %, TDST Status
- Created `src/lib/deploy.ts` with `triggerDeploy()` — called at end of `pages/api/daily.ts` to kick a Vercel rebuild after each cron
- Created `lib/notion/client.ts` + `lib/notion/queries.ts` with `getDailySignals()` for the read path
- Created 6 dashboard components: NewSignalsTable, TopBuys, TopSells, TrendHeatmap, TDSTRisk, SystemHealth
- Next.js auto-updated tsconfig.json (jsx: react-jsx, isolatedModules, noEmit, resolveJsonModule)
- Build: ✓ compiles, 39/39 tests pass; dashboard route is static, API routes are dynamic
- Fixed Vercel deployment: replaced vercel.json with vercel.ts (@vercel/config) to set framework: nextjs — dashboard was 404 without this
- Fixed empty dashboard on weekends: getDailySignals() now falls back to latest available trading day instead of hardcoding today
- Ran backfill twice: first run used old code (pre-deploy), second run after deploy populated all 6 new Notion fields on 25 rows (5 tickers × 5 days)
- Dashboard live and showing signals at /dashboard
- Deploy hook wired up and verified: `VERCEL_DEPLOY_HOOK_URL` set in Vercel env, `triggerDeploy()` confirmed firing (`deployHook: "fired"` in response), new deployment appeared in Vercel dashboard within 30s

## 2026-06-21
- Verified dashboard live with real data after backfill populated 6 new Notion fields
- Security hardening:
  - Replaced `!==` secret comparison with `crypto.timingSafeEqual` across all 3 handlers (`src/lib/auth.ts`)
  - Added npm override to pin `path-to-regexp >= 6.3.0` (GHSA-9wv6-86v2-598j ReDoS)
  - Investigated `vercel@latest` and `@vercel/node@latest` upgrades — both made audit worse (more transitive deps), rolled back to v33/v3
  - Opened GitHub issues #1, #2, #3 to track remaining audit findings
  - Removed `deployHook` debug field from `/api/daily` response
- Audit standing: 38 vulns (2 low, 30 moderate, 6 high) — all 6 highs in devDeps only, not deployed
- Fixed duplicate records on /dashboard:
  - `insertDailySignal` (src/lib/notion.ts) now upserts: queries by exact title before insert, updates existing page if found
  - `getDailySignals` (lib/notion/queries.ts) deduplicates by ticker on read using a Set (first/highest signal strength wins)
- Next: existing duplicate Notion pages remain in DB (harmless, suppressed by query dedup); future cron runs will upsert cleanly
