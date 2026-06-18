import { Bar } from '../types'

interface AlphaVantageDaily {
  'Time Series (Daily)': Record<string, {
    '1. open': string
    '2. high': string
    '3. low': string
    '4. close': string
    '5. volume': string
  }>
}

export async function getHistory(ticker: string): Promise<Bar[]> {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
  const res = await fetch(url)
  const json = await res.json() as AlphaVantageDaily

  const series = json['Time Series (Daily)']
  if (!series) throw new Error(`No data from Alpha Vantage for ${ticker}`)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 300)

  return Object.entries(series)
    .filter(([date]) => new Date(date) >= cutoff)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      open: parseFloat(v['1. open']),
      high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']),
      close: parseFloat(v['4. close']),
      volume: parseInt(v['5. volume'], 10),
    }))
}
