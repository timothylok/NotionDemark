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
