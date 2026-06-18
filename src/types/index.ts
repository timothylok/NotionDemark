export interface Lot {
  id: string
  ticker: string
  buyPrice: number
  transFee: number
  quantity: number
  buyDate: string
}

export interface Bar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface SetupState {
  direction: 'buy' | 'sell' | 'none'
  count: number
  completed: boolean
  lastCompletedStart?: number
  lastCompletedEnd?: number
  lastCompletedDirection?: 'buy' | 'sell'
}

export interface TDSTLevel {
  direction: 'buy' | 'sell'
  level: number
  broken: boolean
}

export interface CountdownState {
  direction: 'buy' | 'sell' | 'none'
  count: number
  completed: boolean
}

export interface SignalDelta {
  setupChanged: boolean
  setupCompleted: boolean
  countdownChanged: boolean
  countdownCompleted: boolean
  tdstNewlyBroken: boolean
  trendChanged: boolean
  prevSetupDirection: 'buy' | 'sell' | 'none'
  prevSetupCount: number
  prevCountdownCount: number
  prevTrend: 'up' | 'down' | 'neutral'
}

export interface TickerSignal {
  ticker: string
  close: number
  setup: SetupState
  countdown: CountdownState
  tdst: TDSTLevel | null
  trend: 'up' | 'down' | 'neutral'
  delta: SignalDelta | null
  avgCost: number
  pnlPct: number
  summary: string
}
