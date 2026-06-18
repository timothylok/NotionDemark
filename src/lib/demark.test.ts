import { computeSetup, computeTDST, computeTDSTDistance, computeSignalStrength, computeReversalProbability, computeAlerts } from './demark'
import { Bar, SetupState, TickerSignal, PrevSnapshot } from '../types'

function bar(close: number, high: number, low: number): Bar {
  return { date: '', open: close, high, low, close, volume: 0 }
}

function makeSetup(dir: 'buy' | 'sell', start: number, end: number): SetupState {
  return {
    direction: dir,
    count: 9,
    completed: true,
    lastCompletedDirection: dir,
    lastCompletedStart: start,
    lastCompletedEnd: end,
  }
}

// 9 bars where each close is lower than 4 bars prior, starting at index `offset`
// Produces bars[offset..offset+8] as a buy setup.
// Pre-pads with `offset` neutral bars so indices align.
function buySetupBars(offset: number): Bar[] {
  const neutral = bar(100, 105, 95)
  const pre = Array(offset).fill(neutral)
  // Closes: 100, 99, 98, 97, 96, 95, 94, 93, 92 — each < close[i-4]
  const setup = [100, 99, 98, 97, 96, 95, 94, 93, 92].map((c, idx) => {
    const isBar14 = idx <= 3
    return bar(c, isBar14 ? 30 + idx : 105, isBar14 ? 20 - idx : 91)
  })
  return [...pre, ...setup]
}

// ─── computeSetup index tracking ─────────────────────────────────────────────

describe('computeSetup — index tracking', () => {
  test('records lastCompleted* after a buy setup of 9 bars', () => {
    // Bars 0..3 are neutral (offset=4 not needed — setup starts at index 4
    // because the comparison needs i-4). Build: 4 neutral + 9 setup bars.
    const neutral = bar(100, 105, 95)
    // Close pattern: descending by 1 each bar. close[i] < close[i-4] requires
    // the drop to persist across 4 bars, so step size must be consistent.
    const closes = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 88, 87, 86]
    //              ^0   ^1   ^2   ^3   ^4   ^5   ^6   ^7   ^8  ^9  ^10 ^11 ^12
    // At i=4: 96 < 100 ✓, at i=5: 95 < 99 ✓, ... at i=12: 86 < 90? 86 < 90 ✓
    const bars = closes.map(c => bar(c, c + 5, c - 5))

    const result = computeSetup(bars)

    expect(result.lastCompletedDirection).toBe('buy')
    // Setup bar 1 is at index 4 (first bar where close < close[i-4])
    expect(result.lastCompletedStart).toBe(4)
    // Setup bar 9 is at index 12
    expect(result.lastCompletedEnd).toBe(12)
  })

  test('returns no lastCompleted fields when no setup completes', () => {
    const bars = [bar(100, 105, 95), bar(101, 106, 96), bar(100, 105, 95)]
    const result = computeSetup(bars)
    expect(result.lastCompletedDirection).toBeUndefined()
  })
})

// ─── computeTDST — sell setup ────────────────────────────────────────────────

describe('computeTDST — sell setup', () => {
  // Setup bars 0..8. Bars 0–3 highs: 10, 12, 11, 13 → TDST = 13
  function sellBars(postBarClose?: number): Bar[] {
    const setup = [
      bar(8,  10, 5),  // bar 0 — high 10
      bar(9,  12, 6),  // bar 1 — high 12
      bar(10, 11, 7),  // bar 2 — high 11
      bar(11, 13, 8),  // bar 3 — high 13 (max)
      bar(12, 12, 7),  // bars 4–8: neutral
      bar(11, 12, 7),
      bar(12, 12, 7),
      bar(11, 12, 7),
      bar(12, 12, 7),  // bar 8 = setup end
    ]
    if (postBarClose !== undefined) setup.push(bar(postBarClose, postBarClose + 1, postBarClose - 1))
    return setup
  }

  test('level = max high of bars 0–3', () => {
    const result = computeTDST(sellBars(), makeSetup('sell', 0, 8))
    expect(result).not.toBeNull()
    expect(result!.level).toBe(13)
  })

  test('broken = false when post-setup closes stay at or below level', () => {
    const result = computeTDST(sellBars(12), makeSetup('sell', 0, 8))
    expect(result!.broken).toBe(false)
  })

  test('broken = true when post-setup close exceeds level', () => {
    const result = computeTDST(sellBars(14), makeSetup('sell', 0, 8))
    expect(result!.broken).toBe(true)
  })

  test('close exactly at level is not broken', () => {
    const result = computeTDST(sellBars(13), makeSetup('sell', 0, 8))
    expect(result!.broken).toBe(false)
  })
})

// ─── computeTDST — buy setup ─────────────────────────────────────────────────

describe('computeTDST — buy setup', () => {
  // Bars 0–3 lows: 20, 18, 19, 17 → TDST = 17
  function buyBars(postBarClose?: number): Bar[] {
    const setup = [
      bar(22, 30, 20),  // bar 0 — low 20
      bar(21, 29, 18),  // bar 1 — low 18
      bar(20, 28, 19),  // bar 2 — low 19
      bar(19, 27, 17),  // bar 3 — low 17 (min)
      bar(20, 28, 18),  // bars 4–8: neutral
      bar(21, 29, 19),
      bar(20, 28, 18),
      bar(21, 29, 19),
      bar(20, 28, 18),  // bar 8 = setup end
    ]
    if (postBarClose !== undefined) setup.push(bar(postBarClose, postBarClose + 1, postBarClose - 1))
    return setup
  }

  test('level = min low of bars 0–3', () => {
    const result = computeTDST(buyBars(), makeSetup('buy', 0, 8))
    expect(result).not.toBeNull()
    expect(result!.level).toBe(17)
  })

  test('broken = false when post-setup closes stay at or above level', () => {
    const result = computeTDST(buyBars(18), makeSetup('buy', 0, 8))
    expect(result!.broken).toBe(false)
  })

  test('broken = true when post-setup close falls below level', () => {
    const result = computeTDST(buyBars(16), makeSetup('buy', 0, 8))
    expect(result!.broken).toBe(true)
  })

  test('close exactly at level is not broken', () => {
    const result = computeTDST(buyBars(17), makeSetup('buy', 0, 8))
    expect(result!.broken).toBe(false)
  })
})

// ─── computeTDSTDistance ─────────────────────────────────────────────────────

describe('computeTDSTDistance', () => {
  test('sell setup, respected, far → positive pct and status far', () => {
    // level=100, close=90 → dist = (100-90)/100*100 = 10%
    const r = computeTDSTDistance('sell', 90, 100, false)
    expect(r.distancePct).toBeCloseTo(10)
    expect(r.status).toBe('far')
  })

  test('sell setup, respected, near → status near', () => {
    // level=100, close=99.5 → dist = 0.5%
    const r = computeTDSTDistance('sell', 99.5, 100, false)
    expect(r.distancePct).toBeCloseTo(0.5)
    expect(r.status).toBe('near')
  })

  test('buy setup, respected → positive pct', () => {
    // level=80, close=90 → dist = (90-80)/80*100 = 12.5%
    const r = computeTDSTDistance('buy', 90, 80, false)
    expect(r.distancePct).toBeCloseTo(12.5)
    expect(r.status).toBe('far')
  })

  test('broken → distancePct 0, status broken', () => {
    const r = computeTDSTDistance('sell', 105, 100, true)
    expect(r.distancePct).toBe(0)
    expect(r.status).toBe('broken')
  })

  test('boundary: exactly 1% → approaching', () => {
    // level=100, close=99 → dist = 1%
    const r = computeTDSTDistance('sell', 99, 100, false)
    expect(r.distancePct).toBeCloseTo(1)
    expect(r.status).toBe('approaching')
  })

  test('boundary: exactly 3% → far', () => {
    // level=100, close=97 → dist = 3%
    const r = computeTDSTDistance('sell', 97, 100, false)
    expect(r.distancePct).toBeCloseTo(3)
    expect(r.status).toBe('far')
  })
})

// ─── computeSignalStrength ───────────────────────────────────────────────────

describe('computeSignalStrength', () => {
  const fullSetup = { count: 9, completed: true, direction: 'sell' as const }
  const fullCountdown = { count: 13, completed: true }
  const noSetup = { count: 0, completed: false, direction: 'none' as const }
  const noCountdown = { count: 0, completed: false }

  test('maximum inputs → high conviction (≥80)', () => {
    // setup 40 + countdown 40 + TDST near 20 + trend opposing 20 = 120 → clamped 100
    const score = computeSignalStrength(fullSetup, fullCountdown, 'up', 'near')
    expect(score).toBe(100)
  })

  test('TDST broken reduces score significantly', () => {
    const withBroken  = computeSignalStrength(fullSetup, fullCountdown, 'up', 'broken')
    const withNear    = computeSignalStrength(fullSetup, fullCountdown, 'up', 'near')
    expect(withBroken).toBeLessThan(withNear)
    // setup 40 + countdown 40 + TDST -20 + trend 20 = 80
    expect(withBroken).toBe(80)
  })

  test('no setup or countdown → low score', () => {
    const score = computeSignalStrength(noSetup, noCountdown, 'neutral', undefined)
    expect(score).toBe(0)
  })

  test('aligned trend (buy in uptrend) penalised vs opposing', () => {
    const setup = { count: 9, completed: true, direction: 'buy' as const }
    const opposing = computeSignalStrength(setup, noCountdown, 'down', undefined)
    const aligned  = computeSignalStrength(setup, noCountdown, 'up',   undefined)
    expect(opposing).toBeGreaterThan(aligned)
    // opposing: 40 + 0 + 0 + 20 = 60; aligned: 40 + 0 + 0 - 10 = 30
    expect(opposing).toBe(60)
    expect(aligned).toBe(30)
  })

  test('absent TDST contributes 0', () => {
    const withNone    = computeSignalStrength(fullSetup, noCountdown, 'neutral', undefined)
    const withApproaching = computeSignalStrength(fullSetup, noCountdown, 'neutral', 'approaching')
    expect(withApproaching).toBeGreaterThan(withNone)
    expect(withNone).toBe(40)
    expect(withApproaching).toBe(50)
  })
})

// ─── computeAlerts ───────────────────────────────────────────────────────────

describe('computeAlerts', () => {
  function makeSignal(overrides: Partial<TickerSignal> = {}): TickerSignal {
    return {
      ticker: 'TEST',
      close: 100,
      setup: { direction: 'sell', count: 9, completed: true },
      countdown: { direction: 'sell', count: 8, completed: false },
      tdst: null,
      tdstStatus: 'far',
      tdstDistancePct: 5,
      signalStrength: 50,
      reversalProbability: 0.5,
      trend: 'up',
      delta: null,
      avgCost: 90,
      pnlPct: 11,
      summary: '',
      ...overrides,
    }
  }

  function makePrev(overrides: Partial<PrevSnapshot> = {}): PrevSnapshot {
    return {
      countdownCount: 7,
      countdownCompleted: false,
      setupCompleted: true,
      tdstStatus: 'far',
      trend: 'up',
      reversalProbability: 0.5,
      prevClose: 100,
      ...overrides,
    }
  }

  test('countdown crossing 12 fires alert', () => {
    const signal = makeSignal({ countdown: { direction: 'sell', count: 12, completed: false } })
    const prev = makePrev({ countdownCount: 11 })
    const alerts = computeAlerts(signal, prev)
    expect(alerts.some(a => a.includes('Countdown 12/13'))).toBe(true)
  })

  test('countdown already ≥12 yesterday does not re-fire', () => {
    const signal = makeSignal({ countdown: { direction: 'sell', count: 12, completed: false } })
    const prev = makePrev({ countdownCount: 12 })
    const alerts = computeAlerts(signal, prev)
    expect(alerts.some(a => a.includes('Countdown'))).toBe(false)
  })

  test('TDST newly near fires alert', () => {
    const signal = makeSignal({ tdstStatus: 'near' })
    const prev = makePrev({ tdstStatus: 'approaching' })
    const alerts = computeAlerts(signal, prev)
    expect(alerts.some(a => a.includes('TDST near'))).toBe(true)
  })

  test('trend flip fires alert with new trend', () => {
    const signal = makeSignal({ trend: 'down' })
    const prev = makePrev({ trend: 'up' })
    const alerts = computeAlerts(signal, prev)
    expect(alerts.some(a => a.includes('Trend flip') && a.includes('down'))).toBe(true)
  })

  test('no events → empty array', () => {
    const alerts = computeAlerts(makeSignal(), makePrev())
    expect(alerts).toHaveLength(0)
  })
})

// ─── computeReversalProbability ──────────────────────────────────────────────

describe('computeReversalProbability', () => {
  test('direction none → returns 0', () => {
    expect(computeReversalProbability(80, 'up', 'none', true, true, 'near')).toBe(0)
  })

  test('full opposing signals → clamped to 1', () => {
    // score=100 → p=1.0, ×1.25 (opposing), ×1.25 (near), +0.05, +0.10 → >>1 → clamp 1
    const p = computeReversalProbability(100, 'up', 'sell', true, true, 'near')
    expect(p).toBe(1)
  })

  test('TDST broken halves probability vs TDST near', () => {
    const base = 60
    const withNear   = computeReversalProbability(base, 'neutral', 'sell', false, false, 'near')
    const withBroken = computeReversalProbability(base, 'neutral', 'sell', false, false, 'broken')
    expect(withNear).toBeGreaterThan(withBroken)
    // near: 0.6 × 1.25 = 0.75; broken: 0.6 × 0.50 = 0.30
    expect(withNear).toBeCloseTo(0.75, 2)
    expect(withBroken).toBeCloseTo(0.30, 2)
  })

  test('aligned trend reduces vs opposing', () => {
    const opposing = computeReversalProbability(60, 'down', 'buy',  false, false, undefined)
    const aligned  = computeReversalProbability(60, 'up',   'buy',  false, false, undefined)
    expect(opposing).toBeGreaterThan(aligned)
    // opposing: 0.6 × 1.25 = 0.75; aligned: 0.6 × 0.75 = 0.45
    expect(opposing).toBeCloseTo(0.75, 2)
    expect(aligned).toBeCloseTo(0.45, 2)
  })

  test('no TDST → no multiplier (neutral)', () => {
    const withNone = computeReversalProbability(60, 'neutral', 'sell', false, false, undefined)
    // 0.6, no trend adj, no TDST adj → 0.60
    expect(withNone).toBeCloseTo(0.60, 2)
  })
})

// ─── computeTDST — edge cases ────────────────────────────────────────────────

describe('computeTDST — edge cases', () => {
  test('returns null when setup has no lastCompletedDirection', () => {
    const setup: SetupState = { direction: 'none', count: 0, completed: false }
    const result = computeTDST([], setup)
    expect(result).toBeNull()
  })

  test('break check starts after bar 9, not before', () => {
    // Buy setup bars 0–8. Bar 5 (before bar 9) has close 15 < 17,
    // but post-bar-9 close is 18 — should NOT be broken.
    const bars = [
      bar(22, 30, 20),
      bar(21, 29, 18),
      bar(20, 28, 19),
      bar(19, 27, 17),
      bar(20, 28, 18),
      bar(15, 16, 14),  // close 15 < 17, but this is BEFORE bar 9
      bar(20, 28, 18),
      bar(21, 29, 19),
      bar(20, 28, 18),  // bar 8 = setup end
      bar(18, 19, 17),  // post-setup close 18 ≥ 17 → not broken
    ]
    const result = computeTDST(bars, makeSetup('buy', 0, 8))
    expect(result!.broken).toBe(false)
  })
})
