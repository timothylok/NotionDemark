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
}

export interface CountdownState {
  direction: 'buy' | 'sell' | 'none'
  count: number
  completed: boolean
}

export interface TickerSignal {
  ticker: string
  close: number
  setup: SetupState
  countdown: CountdownState
  avgCost: number
  pnlPct: number
  summary: string
}
