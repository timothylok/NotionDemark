import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getLots, insertDailySignal } from '../src/lib/notion'
import { getHistory } from '../src/lib/prices'
import { computeSetup, computeCountdown, computeTDST, computeTDSTDistance, computeSignalStrength, computeReversalProbability, computeAlerts, ema, classifyTrend } from '../src/lib/demark'
import { computeAvgCost } from '../src/utils/groupLots'
import { postSummary, postAlerts } from '../src/lib/discord'
import type { TickerSignal, SignalDelta, PrevSnapshot } from '../src/types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const lots = await getLots()
  const tickers = [...new Set(lots.map(l => l.ticker))]
  const signals: TickerSignal[] = []
  const allAlerts: { ticker: string; alerts: string[] }[] = []

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
    let prevSnapshot: PrevSnapshot | null = null
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
      const prevTdstDist = prevTdst
        ? computeTDSTDistance(prevTdst.direction, pb[pb.length - 1].close, prevTdst.level, prevTdst.broken)
        : null
      const prevStrength = computeSignalStrength(prevSetup, prevCountdown, prevTrend, prevTdstDist?.status)
      const prevReversalProbability = computeReversalProbability(
        prevStrength, prevTrend, prevSetup.direction,
        prevSetup.completed, prevCountdown.completed, prevTdstDist?.status
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
      prevSnapshot = {
        countdownCount: prevCountdown.count,
        countdownCompleted: prevCountdown.completed,
        setupCompleted: prevSetup.completed,
        tdstStatus: prevTdstDist?.status,
        trend: prevTrend,
        reversalProbability: prevReversalProbability,
        prevClose: pb[pb.length - 1].close,
      }
    }

    const pnlPct = avgCost === 0 ? 0 : ((close - avgCost) / avgCost) * 100

    const tdstDist = tdst ? computeTDSTDistance(tdst.direction, close, tdst.level, tdst.broken) : null
    const signalStrength = computeSignalStrength(setup, countdown, trend, tdstDist?.status)
    const reversalProbability = computeReversalProbability(
      signalStrength, trend, setup.direction,
      setup.completed, countdown.completed, tdstDist?.status
    )
    const signal: TickerSignal = {
      ticker, close, setup, countdown, tdst,
      tdstDistancePct: tdstDist?.distancePct,
      tdstStatus: tdstDist?.status,
      signalStrength, reversalProbability, trend, delta, avgCost, pnlPct, summary: '',
    }

    await insertDailySignal(signal)
    signals.push(signal)
    allAlerts.push({ ticker, alerts: prevSnapshot ? computeAlerts(signal, prevSnapshot) : [] })
  }

  await postAlerts(allAlerts)
  await postSummary(signals)

  res.status(200).json({ ok: true })
}
