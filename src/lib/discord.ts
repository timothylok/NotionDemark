import { TickerSignal } from '../types'

export async function postAlerts(allAlerts: { ticker: string; alerts: string[] }[]): Promise<void> {
  const firing = allAlerts.filter(a => a.alerts.length > 0)
  if (firing.length === 0) return

  const today = new Date().toISOString().slice(0, 10)
  const lines = firing.map(a => `${a.ticker}: ${a.alerts.join(' | ')}`)
  await fetch(process.env.DISCORD_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🔔 DeMark Alerts – ${today}\n\n${lines.join('\n')}`,
    }),
  })
}

export async function postSummary(signals: TickerSignal[]): Promise<void> {
  const lines = signals.map(s => {
    const d = s.delta

    let setupSuffix = ''
    if (d?.setupCompleted) {
      setupSuffix = '  <- COMPLETED'
    } else if (d?.setupChanged) {
      const prevDir = d.prevSetupDirection !== s.setup.direction ? `${d.prevSetupDirection} ` : ''
      setupSuffix = `  (was ${prevDir}${d.prevSetupCount}/9)`
    }

    let countdownSuffix = ''
    if (d?.countdownCompleted) {
      countdownSuffix = '  <- COMPLETED'
    } else if (d?.countdownChanged) {
      countdownSuffix = `  (was ${d.prevCountdownCount}/13)`
    }

    let tdstLine = ''
    if (s.tdst) {
      const label = s.tdst.direction === 'buy' ? 'Support' : 'Resistance'
      const statusLabel = d?.tdstNewlyBroken ? 'BROKE TODAY' : (s.tdstStatus ?? 'broken')
      const distPart = s.tdstStatus !== 'broken' && s.tdstDistancePct !== undefined
        ? ` (+${s.tdstDistancePct.toFixed(1)}%)`
        : ''
      tdstLine = `\n  • TDST ${label}: ${s.tdst.level.toFixed(2)} — ${statusLabel}${distPart}`
    }

    const trendLabel = s.trend === 'up' ? 'Up' : s.trend === 'down' ? 'Down' : 'Neutral'
    const trendSuffix = d?.trendChanged ? `  (was ${d.prevTrend})` : ''

    const volLabel = s.volatility === 'low' ? 'Low' : s.volatility === 'high' ? 'High' : 'Normal'
    const volLine = `\n  • Volatility: ${volLabel} (ATR ${s.atrPct.toFixed(1)}%)`

    const score = s.signalStrength
    const scoreLabel = score >= 80 ? 'High Conviction' : score >= 60 ? 'Strong' : score >= 30 ? 'Moderate' : 'Low'
    const scoreDir = s.setup.direction !== 'none' ? ` ${s.setup.direction === 'buy' ? 'Buy' : 'Sell'}` : ''

    return (
      `${s.ticker} [${score}/100 – ${scoreLabel}${scoreDir}]: Close ${s.close.toFixed(2)} (${s.pnlPct.toFixed(2)}%) vs Avg ${s.avgCost.toFixed(2)}\n` +
      `  • Trend: ${trendLabel}${trendSuffix}\n` +
      `  • P(reversal): ${s.reversalProbability.toFixed(2)}\n` +
      `  • Setup: ${s.setup.direction} ${s.setup.count}/9${setupSuffix}\n` +
      `  • Countdown: ${s.countdown.count}/13${countdownSuffix}` +
      volLine +
      tdstLine
    )
  })

  await fetch(process.env.DISCORD_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `US Portfolio – DeMark Daily\n\n${lines.join('\n\n')}`,
    }),
  })
}
