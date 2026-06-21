import { notion } from './client'

export interface DailyRow {
  ticker: string
  date: string
  close: number
  setupText: string
  countdownText: string
  avgCost: number
  pnlPct: number
  atrPct: number
  volatility: 'low' | 'normal' | 'high'
  trend: 'up' | 'down' | 'neutral'
  setupDirection: 'buy' | 'sell' | 'none'
  setupCount: number
  signalStrength: number
  tdstDistancePct: number
  tdstStatus: 'near' | 'approaching' | 'far' | 'broken'
}

function str(page: any, prop: string): string {
  const p = page.properties[prop]
  if (p?.title) return p.title[0]?.plain_text ?? ''
  if (p?.rich_text) return p.rich_text[0]?.plain_text ?? ''
  if (p?.select) return p.select?.name ?? ''
  return ''
}

function num(page: any, prop: string): number {
  return page.properties[prop]?.number ?? 0
}

function parseRows(results: any[]): DailyRow[] {
  return results.flatMap(page => {
    const title = str(page, 'Date')
    const spaceIdx = title.indexOf(' ')
    if (spaceIdx === -1) return []
    return [{
      ticker: title.slice(0, spaceIdx),
      date: title.slice(spaceIdx + 1),
      close: num(page, 'Close Price'),
      setupText: str(page, 'Setup'),
      countdownText: str(page, 'Countdown'),
      avgCost: num(page, 'Avg Cost'),
      pnlPct: num(page, 'PnL %') * 100,
      atrPct: num(page, 'ATR %'),
      volatility: (str(page, 'Volatility') || 'normal') as DailyRow['volatility'],
      trend: (str(page, 'Trend') || 'neutral') as DailyRow['trend'],
      setupDirection: (str(page, 'Setup Direction') || 'none') as DailyRow['setupDirection'],
      setupCount: num(page, 'Setup Count'),
      signalStrength: num(page, 'Signal Strength'),
      tdstDistancePct: num(page, 'TDST Distance %'),
      tdstStatus: (str(page, 'TDST Status') || 'far') as DailyRow['tdstStatus'],
    }]
  })
}

export async function getDailySignals(date?: string): Promise<DailyRow[]> {
  if (date) {
    const res = await notion.databases.query({
      database_id: process.env.NOTION_DAILY_DB_ID!,
      filter: { property: 'Date', title: { contains: date } } as any,
      sorts: [{ property: 'Signal Strength', direction: 'descending' }],
    })
    return parseRows(res.results)
  }

  // No date specified — fetch recent rows and return the latest trading day's batch
  const res = await notion.databases.query({
    database_id: process.env.NOTION_DAILY_DB_ID!,
    page_size: 50,
    sorts: [{ property: 'Signal Strength', direction: 'descending' }],
  })

  const rows = parseRows(res.results as any[])
  if (!rows.length) return []

  const latestDate = rows.reduce((max, r) => (r.date > max ? r.date : max), '')
  return rows.filter(r => r.date === latestDate)
}
