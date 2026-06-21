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

export async function getDailySignals(date?: string): Promise<DailyRow[]> {
  const today = date ?? new Date().toISOString().slice(0, 10)

  const res = await notion.databases.query({
    database_id: process.env.NOTION_DAILY_DB_ID!,
    filter: {
      property: 'Date',
      title: { contains: today },
    } as any,
    sorts: [{ property: 'Signal Strength', direction: 'descending' }],
  })

  return (res.results as any[]).flatMap(page => {
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
