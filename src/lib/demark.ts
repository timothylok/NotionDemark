import { Bar, SetupState, CountdownState } from '../types'

export function computeSetup(bars: Bar[]): SetupState {
  let buyCount = 0
  let sellCount = 0

  for (let i = 4; i < bars.length; i++) {
    const today = bars[i]
    const prev4 = bars[i - 4]

    if (today.close < prev4.close) {
      buyCount++
      sellCount = 0
    } else if (today.close > prev4.close) {
      sellCount++
      buyCount = 0
    } else {
      buyCount = 0
      sellCount = 0
    }
  }

  if (buyCount > 0) return { direction: 'buy', count: buyCount, completed: buyCount >= 9 }
  if (sellCount > 0) return { direction: 'sell', count: sellCount, completed: sellCount >= 9 }
  return { direction: 'none', count: 0, completed: false }
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
