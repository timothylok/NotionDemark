import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getLots, insertDailySignal } from '../src/lib/notion'
import { getHistory } from '../src/lib/prices'
import { computeSetup, computeCountdown, computeTDST, ema, classifyTrend } from '../src/lib/demark'
import { computeAvgCost } from '../src/utils/groupLots'
import { postSummary } from '../src/lib/discord'
import type { TickerSignal, SignalDelta } from '../src/types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const lots = await getLots()
  const tickers = [...new Set(lots.map(l => l.ticker))]
  const signals: TickerSignal[] = []

  for (const ticker of tickers) {
    const tickerLots = lots.filter(l => l.ticker === ticker)
    const avgCost = computeAvgCost(tickerLots)

    const bars = await getHistory(ticker)
    const setup = computeSetup(bars)
    const countdown = computeCountdown(bars, setup)
    const tdst = computeTDST(bars, setup)

    const close = bars[bars.length - 1]?.close ?? 0
    const closes = bars.map(b => b.close)
    const ema20arr = ema(closes, 20)
    const ema50arr = ema(closes, 50)
    const trend = classifyTrend(close, ema20arr[ema20arr.length - 1], ema50arr[ema50arr.length - 1])

    let delta: SignalDelta | null = null
    if (bars.length > 1) {
      const pb = bars.slice(0, -1)
      const prevSetup = computeSetup(pb)
      const prevCountdown = computeCountdown(pb, prevSetup)
      const prevTdst = computeTDST(pb, prevSetup)
      const prevCloses = pb.map(b => b.close)
      const prevEma20arr = ema(prevCloses, 20)
      const prevEma50arr = ema(prevCloses, 50)
      const prevTrend = classifyTrend(
        pb[pb.length - 1].close,
        prevEma20arr[prevEma20arr.length - 1],
        prevEma50arr[prevEma50arr.length - 1]
      )
      delta = {
        setupChanged: prevSetup.count !== setup.count || prevSetup.direction !== setup.direction,
        setupCompleted: setup.completed && !prevSetup.completed,
        countdownChanged: prevCountdown.count !== countdown.count,
        countdownCompleted: countdown.completed && !prevCountdown.completed,
        tdstNewlyBroken: (tdst?.broken ?? false) && !(prevTdst?.broken ?? false),
        trendChanged: prevTrend !== trend,
        prevSetupDirection: prevSetup.direction,
        prevSetupCount: prevSetup.count,
        prevCountdownCount: prevCountdown.count,
        prevTrend,
      }
    }

    const pnlPct = avgCost === 0 ? 0 : ((close - avgCost) / avgCost) * 100

    const signal: TickerSignal = { ticker, close, setup, countdown, tdst, trend, delta, avgCost, pnlPct, summary: '' }

    await insertDailySignal(signal)
    signals.push(signal)
  }

  await postSummary(signals)

  res.status(200).json({ ok: true })
}
