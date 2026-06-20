import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Client } from '@notionhq/client'
import { getLots } from '../src/lib/notion'
import { getHistory } from '../src/lib/prices'
import {
  computeSetup, computeCountdown, computeTDST, computeTDSTDistance,
  computeSignalStrength, computeReversalProbability,
  computeATR, classifyVolatility, ema, classifyTrend,
} from '../src/lib/demark'
import { computeAvgCost } from '../src/utils/groupLots'
import type { TickerSignal } from '../src/types'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

async function upsertSignal(signal: TickerSignal, date: string): Promise<'inserted' | 'updated'> {
  const title = `${signal.ticker} ${date}`
  const properties: Record<string, any> = {
    Ticker: { select: { name: signal.ticker } },
    'Close Price': { number: signal.close },
    Setup: { rich_text: [{ text: { content: `${signal.setup.direction} ${signal.setup.count}/9` } }] },
    Countdown: { rich_text: [{ text: { content: `${signal.countdown.count}/13` } }] },
    'Avg Cost': { number: signal.avgCost },
    'PnL %': { number: signal.pnlPct / 100 },
    'ATR %': { number: parseFloat(signal.atrPct.toFixed(2)) },
    Volatility: { select: { name: signal.volatility } },
    Summary: { rich_text: [{ text: { content: signal.summary } }] },
  }

  const existing = await notion.databases.query({
    database_id: process.env.NOTION_DAILY_DB_ID!,
    filter: { property: 'Date', title: { equals: title } } as any,
  })

  if (existing.results.length > 0) {
    await notion.pages.update({ page_id: (existing.results[0] as any).id, properties })
    return 'updated'
  }

  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DAILY_DB_ID! },
    properties: { Date: { title: [{ text: { content: title } }] }, ...properties },
  })
  return 'inserted'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const days = Math.min(parseInt(String(req.query.days ?? '5'), 10) || 5, 30)

  const lots = await getLots()
  const tickers = [...new Set(lots.map(l => l.ticker))]

  const summary: Record<string, { inserted: number; updated: number }> = {}
  let total = 0

  for (const ticker of tickers) {
    const tickerLots = lots.filter(l => l.ticker === ticker)
    const avgCost = computeAvgCost(tickerLots)
    const bars = await getHistory(ticker)

    const startIdx = Math.max(0, bars.length - days)
    summary[ticker] = { inserted: 0, updated: 0 }

    for (let i = startIdx; i < bars.length; i++) {
      const slicedBars = bars.slice(0, i + 1)
      const date = slicedBars[slicedBars.length - 1].date.slice(0, 10)

      const setup = computeSetup(slicedBars)
      const countdown = computeCountdown(slicedBars, setup)
      const tdst = computeTDST(slicedBars, setup)
      const close = slicedBars[slicedBars.length - 1].close
      const closes = slicedBars.map(b => b.close)
      const ema20arr = ema(closes, 20)
      const ema50arr = ema(closes, 50)
      const trend = classifyTrend(close, ema20arr[ema20arr.length - 1], ema50arr[ema50arr.length - 1])
      const atr = computeATR(slicedBars)
      const atrPct = close > 0 ? (atr / close) * 100 : 0
      const volatility = classifyVolatility(atrPct)
      const tdstDist = tdst ? computeTDSTDistance(tdst.direction, close, tdst.level, tdst.broken) : null
      const signalStrength = computeSignalStrength(setup, countdown, trend, tdstDist?.status)
      const reversalProbability = computeReversalProbability(
        signalStrength, trend, setup.direction,
        setup.completed, countdown.completed, tdstDist?.status,
      )
      const pnlPct = avgCost === 0 ? 0 : ((close - avgCost) / avgCost) * 100

      const signal: TickerSignal = {
        ticker, close, setup, countdown, tdst,
        tdstDistancePct: tdstDist?.distancePct,
        tdstStatus: tdstDist?.status,
        atrPct, volatility, signalStrength, reversalProbability,
        trend, delta: null, avgCost, pnlPct, summary: '',
      }

      const result = await upsertSignal(signal, date)
      summary[ticker][result]++
      total++
    }
  }

  res.status(200).json({ ok: true, days, tickers: tickers.length, total, summary })
}
