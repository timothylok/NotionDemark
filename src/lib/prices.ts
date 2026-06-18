import yahooFinance from 'yahoo-finance2'
import { Bar } from '../types'

export async function getHistory(ticker: string): Promise<Bar[]> {
  const period1 = new Date()
  period1.setDate(period1.getDate() - 300)

  const result = await yahooFinance.chart(ticker, {
    period1: period1.toISOString().slice(0, 10),
    interval: '1d',
  })

  return (result.quotes ?? []).map(r => ({
    date: r.date.toISOString(),
    open: r.open ?? 0,
    high: r.high ?? 0,
    low: r.low ?? 0,
    close: r.close ?? 0,
    volume: r.volume ?? 0,
  }))
}
