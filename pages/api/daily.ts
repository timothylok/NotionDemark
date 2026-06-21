import type { NextApiRequest, NextApiResponse } from 'next'
import { getLots, insertDailySignal } from '../../src/lib/notion'
import { getHistory } from '../../src/lib/prices'
import { computeSignal, computeAlerts } from '../../src/lib/demark'
import { postSummary, postAlerts } from '../../src/lib/discord'
import { triggerDeploy } from '../../src/lib/deploy'
import type { TickerSignal } from '../../src/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const lots = await getLots()
  const tickers = [...new Set(lots.map(l => l.ticker))]
  const signals: TickerSignal[] = []
  const allAlerts: { ticker: string; alerts: string[] }[] = []

  for (const ticker of tickers) {
    const tickerLots = lots.filter(l => l.ticker === ticker)
    const bars = await getHistory(ticker)
    const { signal, prevSnapshot } = computeSignal(bars, tickerLots)
    await insertDailySignal(signal)
    signals.push(signal)
    allAlerts.push({ ticker, alerts: prevSnapshot ? computeAlerts(signal, prevSnapshot) : [] })
  }

  await postAlerts(allAlerts)
  await postSummary(signals)
  const deployStatus = await triggerDeploy()

  res.status(200).json({ ok: true, deployHook: deployStatus })
}
