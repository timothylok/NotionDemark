import type { NextApiRequest, NextApiResponse } from 'next'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

function lastNTradingDays(n: number): string[] {
  const dates: string[] = []
  const d = new Date()
  while (dates.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().slice(0, 10))
    }
    d.setDate(d.getDate() - 1)
  }
  return dates // most recent first
}

function parseSetup(text: string): { direction: string; count: number } {
  const [dir = 'none', rest = '0/9'] = text.split(' ')
  return { direction: dir, count: parseInt(rest.split('/')[0], 10) || 0 }
}

function parseCountdown(text: string): number {
  const [, rest = '0/13'] = text.split(' ')
  return parseInt(rest.split('/')[0], 10) || 0
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface WeekRecord {
  ticker: string
  date: string
  setup: string
  countdown: string
  pnlPct: number
  volatility: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const dates = lastNTradingDays(5)
  const from = dates[dates.length - 1]
  const to = dates[0]

  const response = await notion.databases.query({
    database_id: process.env.NOTION_DAILY_DB_ID!,
    filter: {
      or: dates.map(d => ({
        property: 'Date',
        title: { contains: d },
      })),
    } as any,
  })

  const records: WeekRecord[] = (response.results as any[]).flatMap(page => {
    const props = page.properties
    const title: string = props.Date?.title?.[0]?.plain_text ?? ''
    const spaceIdx = title.indexOf(' ')
    if (spaceIdx === -1) return []
    return [{
      ticker: title.slice(0, spaceIdx),
      date: title.slice(spaceIdx + 1),
      setup: props.Setup?.rich_text?.[0]?.plain_text ?? 'none 0/9',
      countdown: props.Countdown?.rich_text?.[0]?.plain_text ?? 'none 0/13',
      pnlPct: (props['PnL %']?.number ?? 0) * 100,
      volatility: props.Volatility?.select?.name ?? 'normal',
    }]
  })

  const byTicker = new Map<string, WeekRecord[]>()
  for (const r of records) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, [])
    byTicker.get(r.ticker)!.push(r)
  }
  for (const recs of byTicker.values()) {
    recs.sort((a, b) => a.date.localeCompare(b.date))
  }

  const lines = [...byTicker.keys()].sort().map(ticker => {
    const recs = byTicker.get(ticker)!
    const first = recs[0]
    const last = recs[recs.length - 1]

    const s0 = parseSetup(first.setup)
    const s1 = parseSetup(last.setup)
    const c0 = parseCountdown(first.countdown)
    const c1 = parseCountdown(last.countdown)

    const dirPart = s0.direction === s1.direction
      ? cap(s1.direction)
      : `${cap(s0.direction)}→${cap(s1.direction)}`

    const pnl0 = `${first.pnlPct >= 0 ? '+' : ''}${first.pnlPct.toFixed(1)}%`
    const pnl1 = `${last.pnlPct >= 0 ? '+' : ''}${last.pnlPct.toFixed(1)}%`

    return `${ticker}: ${dirPart} Setup ${s0.count}→${s1.count}, Countdown ${c0}→${c1}, PnL ${pnl0} → ${pnl1}  [${cap(last.volatility)} vol]`
  })

  const content = `📊 Weekly DeMark Summary – ${from} to ${to}\n\n${lines.join('\n')}`

  await fetch(process.env.DISCORD_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })

  res.status(200).json({ ok: true, tickers: byTicker.size, days: dates.length })
}
