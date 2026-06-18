import { Bar } from '../types'

interface TiingoBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export async function getHistory(ticker: string): Promise<Bar[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 300)

  const url = `https://api.tiingo.com/tiingo/daily/${ticker}/prices?startDate=${startDate.toISOString().slice(0, 10)}&token=${process.env.TIINGO_API_KEY}`
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })

  if (!res.ok) throw new Error(`Tiingo error for ${ticker}: ${res.status} ${res.statusText}`)

  const json = await res.json() as TiingoBar[]
  if (!Array.isArray(json) || json.length === 0) throw new Error(`No data from Tiingo for ${ticker}`)

  return json.map(r => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }))
}
