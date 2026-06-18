import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getLots, insertDailySignal } from '../src/lib/notion'
import { getHistory } from '../src/lib/prices'
import { computeSetup, computeCountdown, computeTDST } from '../src/lib/demark'
import { computeAvgCost } from '../src/utils/groupLots'
import { postSummary } from '../src/lib/discord'
import type { TickerSignal } from '../src/types'

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
    const pnlPct = avgCost === 0 ? 0 : ((close - avgCost) / avgCost) * 100

    const signal: TickerSignal = { ticker, close, setup, countdown, tdst, avgCost, pnlPct, summary: '' }

    await insertDailySignal(signal)
    signals.push(signal)
  }

  await postSummary(signals)

  res.status(200).json({ ok: true })
}
