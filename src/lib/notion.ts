import { Client } from '@notionhq/client'
import { Lot, TickerSignal } from '../types'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

function num(page: any, prop: string): number {
  return page.properties[prop]?.number ?? 0
}

function text(page: any, prop: string): string {
  const p = page.properties[prop]
  if (p?.title) return p.title[0]?.plain_text ?? ''
  if (p?.rich_text) return p.rich_text[0]?.plain_text ?? ''
  if (p?.select) return p.select?.name ?? ''
  return ''
}

function date(page: any, prop: string): string {
  return page.properties[prop]?.date?.start ?? ''
}

export async function getLots(): Promise<Lot[]> {
  const pages: any[] = []
  let cursor: string | undefined

  do {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_LOTS_DB_ID!,
      start_cursor: cursor,
    })
    pages.push(...response.results)
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return pages.map(page => ({
    id: page.id,
    ticker: text(page, 'Ticker'),
    buyPrice: num(page, 'Buy Price'),
    transFee: num(page, 'Transaction Fee'),
    quantity: num(page, 'Quantity'),
    buyDate: date(page, 'Buy Date'),
  }))
}

export async function insertDailySignal(signal: TickerSignal): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DAILY_DB_ID! },
    properties: {
      Date: { title: [{ text: { content: `${signal.ticker} ${today}` } }] },
      Ticker: { select: { name: signal.ticker } },
      'Close Price': { number: signal.close },
      Setup: { rich_text: [{ text: { content: `${signal.setup.direction} ${signal.setup.count}/9` } }] },
      Countdown: { rich_text: [{ text: { content: `${signal.countdown.count}/13` } }] },
      'Avg Cost': { number: signal.avgCost },
      'PnL %': { number: signal.pnlPct / 100 },
      'ATR %': { number: parseFloat(signal.atrPct.toFixed(2)) },
      Volatility: { select: { name: signal.volatility } },
      Summary: { rich_text: [{ text: { content: signal.summary } }] },
      Trend: { select: { name: signal.trend } },
      'Setup Direction': { select: { name: signal.setup.direction } },
      'Setup Count': { number: signal.setup.count },
      'Signal Strength': { number: signal.signalStrength },
      'TDST Distance %': { number: signal.tdstDistancePct != null ? parseFloat(signal.tdstDistancePct.toFixed(2)) : 0 },
      'TDST Status': { select: { name: signal.tdstStatus ?? 'far' } },
    },
  })
}
