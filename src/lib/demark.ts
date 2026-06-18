import { Bar, SetupState, CountdownState, TDSTLevel } from '../types'

export function computeSetup(bars: Bar[]): SetupState {
  let buyCount = 0, sellCount = 0
  let buyStart = -1, sellStart = -1
  let lastCompletedStart = -1, lastCompletedEnd = -1
  let lastCompletedDirection: 'buy' | 'sell' | null = null

  for (let i = 4; i < bars.length; i++) {
    const c = bars[i].close, p = bars[i - 4].close

    if (c < p) {
      if (buyCount === 0) buyStart = i
      buyCount++; sellCount = 0; sellStart = -1
      if (buyCount === 9) {
        lastCompletedStart = buyStart; lastCompletedEnd = i
        lastCompletedDirection = 'buy'
      }
    } else if (c > p) {
      if (sellCount === 0) sellStart = i
      sellCount++; buyCount = 0; buyStart = -1
      if (sellCount === 9) {
        lastCompletedStart = sellStart; lastCompletedEnd = i
        lastCompletedDirection = 'sell'
      }
    } else {
      buyCount = 0; sellCount = 0; buyStart = -1; sellStart = -1
    }
  }

  const result: SetupState = {
    direction: buyCount > 0 ? 'buy' : sellCount > 0 ? 'sell' : 'none',
    count: buyCount > 0 ? buyCount : sellCount,
    completed: buyCount >= 9 || sellCount >= 9,
  }
  if (lastCompletedDirection !== null) {
    result.lastCompletedStart = lastCompletedStart
    result.lastCompletedEnd = lastCompletedEnd
    result.lastCompletedDirection = lastCompletedDirection
  }
  return result
}

export function computeTDST(bars: Bar[], setup: SetupState): TDSTLevel | null {
  const { lastCompletedDirection: dir, lastCompletedStart: start, lastCompletedEnd: end } = setup
  if (dir == null || start == null || end == null || start + 3 >= bars.length) return null

  const level = dir === 'sell'
    ? Math.max(bars[start].high, bars[start + 1].high, bars[start + 2].high, bars[start + 3].high)
    : Math.min(bars[start].low,  bars[start + 1].low,  bars[start + 2].low,  bars[start + 3].low)

  let broken = false
  for (let i = end + 1; i < bars.length; i++) {
    if (dir === 'sell' && bars[i].close > level) { broken = true; break }
    if (dir === 'buy'  && bars[i].close < level) { broken = true; break }
  }
  return { direction: dir, level, broken }
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result = [values[0]]
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

export function classifyTrend(
  price: number, ema20: number, ema50: number
): 'up' | 'down' | 'neutral' {
  if (ema20 > ema50 && price > ema20) return 'up'
  if (ema20 < ema50 && price < ema20) return 'down'
  return 'neutral'
}

export function computeTDSTDistance(
  direction: 'buy' | 'sell',
  close: number,
  level: number,
  broken: boolean,
): { distancePct: number; status: 'near' | 'approaching' | 'far' | 'broken' } {
  if (broken) return { distancePct: 0, status: 'broken' }
  const distancePct = direction === 'sell'
    ? (level - close) / level * 100
    : (close - level) / level * 100
  const status = distancePct < 1 ? 'near' : distancePct < 3 ? 'approaching' : 'far'
  return { distancePct, status }
}

export function computeCountdown(bars: Bar[], setup: SetupState): CountdownState {
  if (!setup.completed) {
    return { direction: 'none', count: 0, completed: false }
  }

  let count = 0
  const direction = setup.direction

  for (let i = 2; i < bars.length; i++) {
    const today = bars[i]
    const prev2 = bars[i - 2]

    if (direction === 'buy' && today.close <= prev2.low) count++
    if (direction === 'sell' && today.close >= prev2.high) count++

    if (count >= 13) break
  }

  return { direction, count, completed: count >= 13 }
}
