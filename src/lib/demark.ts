import { Bar, SetupState, CountdownState, TDSTLevel, TickerSignal, SignalDelta, PrevSnapshot, Lot } from '../types'
import { computeAvgCost } from '../utils/groupLots'

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
    count: Math.min(buyCount > 0 ? buyCount : sellCount, 9),
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

export function computeSignalStrength(
  setup: { count: number; completed: boolean; direction: 'buy' | 'sell' | 'none' },
  countdown: { count: number; completed: boolean },
  trend: 'up' | 'down' | 'neutral',
  tdstStatus?: 'near' | 'approaching' | 'far' | 'broken',
): number {
  const setupScore = Math.min((setup.count / 9) * 40 + (setup.completed ? 10 : 0), 40)
  const countdownScore = Math.min((countdown.count / 13) * 40 + (countdown.completed ? 10 : 0), 40)

  let tdstScore = 0
  if (tdstStatus === 'broken') tdstScore = -20
  else if (tdstStatus === 'near') tdstScore = 20
  else if (tdstStatus === 'approaching') tdstScore = 10

  let trendScore = 0
  if (trend === 'up'   && setup.direction === 'sell') trendScore = 20
  if (trend === 'down' && setup.direction === 'buy')  trendScore = 20
  if (trend === 'up'   && setup.direction === 'buy')  trendScore = -10
  if (trend === 'down' && setup.direction === 'sell') trendScore = -10

  return Math.round(Math.max(0, Math.min(setupScore + countdownScore + tdstScore + trendScore, 100)))
}

export function computeReversalProbability(
  score: number,
  trend: 'up' | 'down' | 'neutral',
  direction: 'buy' | 'sell' | 'none',
  setupCompleted: boolean,
  countdownCompleted: boolean,
  tdstStatus?: 'near' | 'approaching' | 'far' | 'broken',
): number {
  if (direction === 'none') return 0

  let p = score / 100

  if (trend === 'up'   && direction === 'sell') p *= 1.25
  if (trend === 'down' && direction === 'buy')  p *= 1.25
  if (trend === 'up'   && direction === 'buy')  p *= 0.75
  if (trend === 'down' && direction === 'sell') p *= 0.75

  if      (tdstStatus === 'near')        p *= 1.25
  else if (tdstStatus === 'approaching') p *= 1.10
  else if (tdstStatus === 'far')         p *= 0.90
  else if (tdstStatus === 'broken')      p *= 0.50

  if (setupCompleted)     p += 0.05
  if (countdownCompleted) p += 0.10

  return Number(Math.max(0, Math.min(p, 1)).toFixed(2))
}

export function computeATR(bars: Bar[], period = 14): number {
  if (bars.length < 2) return 0
  let atr = 0
  const seedLen = Math.min(period, bars.length - 1)
  for (let i = 1; i <= seedLen; i++) {
    atr += Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low  - bars[i - 1].close),
    )
  }
  atr /= seedLen
  for (let i = period + 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low  - bars[i - 1].close),
    )
    atr = (atr * (period - 1) + tr) / period
  }
  return atr
}

export function classifyVolatility(atrPct: number): 'low' | 'normal' | 'high' {
  if (atrPct < 1) return 'low'
  if (atrPct < 3) return 'normal'
  return 'high'
}

export function computeAlerts(signal: TickerSignal, prev: PrevSnapshot): string[] {
  const alerts: string[] = []
  const { countdown, setup, tdstStatus, trend, reversalProbability, close } = signal

  if (countdown.count >= 12 && prev.countdownCount < 12)
    alerts.push(`🔥 Countdown ${countdown.count}/13 – reversal imminent`)

  if (countdown.completed && !prev.countdownCompleted)
    alerts.push('🔥 Countdown 13/13 – exhaustion completed')

  if (tdstStatus === 'near' && prev.tdstStatus !== 'near')
    alerts.push('⚠️ TDST near – price testing level')

  if (tdstStatus === 'broken' && prev.tdstStatus !== 'broken')
    alerts.push('❌ TDST broken – level failed')

  if (trend !== prev.trend)
    alerts.push(`📈 Trend flip → ${trend}`)

  if (setup.completed && !prev.setupCompleted)
    alerts.push('🟩 Setup 9 completed')

  if (reversalProbability > 0.75 && prev.reversalProbability <= 0.75)
    alerts.push(`🟦 Reversal probability spike (${reversalProbability.toFixed(2)})`)

  if (prev.prevClose > 0) {
    const dailyMove = (close - prev.prevClose) / prev.prevClose * 100
    if (Math.abs(dailyMove) > 5)
      alerts.push(`🟧 Large daily move (${dailyMove > 0 ? '+' : ''}${dailyMove.toFixed(1)}%)`)
  }

  return alerts
}

export function computeSignal(bars: Bar[], lots: Lot[]): { signal: TickerSignal; prevSnapshot: PrevSnapshot | null } {
  const ticker = lots[0]?.ticker ?? ''
  const avgCost = computeAvgCost(lots)

  const setup = computeSetup(bars)
  const countdown = computeCountdown(bars, setup)
  const tdst = computeTDST(bars, setup)
  const close = bars[bars.length - 1]?.close ?? 0
  const closes = bars.map(b => b.close)
  const ema20arr = ema(closes, 20)
  const ema50arr = ema(closes, 50)
  const trend = classifyTrend(close, ema20arr[ema20arr.length - 1], ema50arr[ema50arr.length - 1])
  const atr = computeATR(bars)
  const atrPct = close > 0 ? (atr / close) * 100 : 0
  const volatility = classifyVolatility(atrPct)
  const tdstDist = tdst ? computeTDSTDistance(tdst.direction, close, tdst.level, tdst.broken) : null
  const signalStrength = computeSignalStrength(setup, countdown, trend, tdstDist?.status)
  const reversalProbability = computeReversalProbability(
    signalStrength, trend, setup.direction,
    setup.completed, countdown.completed, tdstDist?.status,
  )
  const pnlPct = avgCost === 0 ? 0 : ((close - avgCost) / avgCost) * 100

  let delta: SignalDelta | null = null
  let prevSnapshot: PrevSnapshot | null = null
  if (bars.length > 1) {
    const pb = bars.slice(0, -1)
    const prevSetup = computeSetup(pb)
    const prevCountdown = computeCountdown(pb, prevSetup)
    const prevTdst = computeTDST(pb, prevSetup)
    const prevCloses = pb.map(b => b.close)
    const prevEma20arr = ema(prevCloses, 20)
    const prevEma50arr = ema(prevCloses, 50)
    const prevTrend = classifyTrend(
      pb[pb.length - 1].close,
      prevEma20arr[prevEma20arr.length - 1],
      prevEma50arr[prevEma50arr.length - 1],
    )
    const prevTdstDist = prevTdst
      ? computeTDSTDistance(prevTdst.direction, pb[pb.length - 1].close, prevTdst.level, prevTdst.broken)
      : null
    const prevStrength = computeSignalStrength(prevSetup, prevCountdown, prevTrend, prevTdstDist?.status)
    const prevReversalProbability = computeReversalProbability(
      prevStrength, prevTrend, prevSetup.direction,
      prevSetup.completed, prevCountdown.completed, prevTdstDist?.status,
    )
    delta = {
      setupChanged: prevSetup.count !== setup.count || prevSetup.direction !== setup.direction,
      setupCompleted: setup.completed && !prevSetup.completed,
      countdownChanged: prevCountdown.count !== countdown.count,
      countdownCompleted: countdown.completed && !prevCountdown.completed,
      tdstNewlyBroken: (tdst?.broken ?? false) && !(prevTdst?.broken ?? false),
      trendChanged: prevTrend !== trend,
      prevSetupDirection: prevSetup.direction,
      prevSetupCount: prevSetup.count,
      prevCountdownCount: prevCountdown.count,
      prevTrend,
    }
    prevSnapshot = {
      countdownCount: prevCountdown.count,
      countdownCompleted: prevCountdown.completed,
      setupCompleted: prevSetup.completed,
      tdstStatus: prevTdstDist?.status,
      trend: prevTrend,
      reversalProbability: prevReversalProbability,
      prevClose: pb[pb.length - 1].close,
    }
  }

  const signal: TickerSignal = {
    ticker, close, setup, countdown, tdst,
    tdstDistancePct: tdstDist?.distancePct,
    tdstStatus: tdstDist?.status,
    atrPct, volatility, signalStrength, reversalProbability,
    trend, delta, avgCost, pnlPct, summary: '',
  }
  return { signal, prevSnapshot }
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
