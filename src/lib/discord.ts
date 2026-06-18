import { TickerSignal } from '../types'

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

    return (
      `${s.ticker}: Close ${s.close.toFixed(2)} (${s.pnlPct.toFixed(2)}%) vs Avg ${s.avgCost.toFixed(2)}\n` +
      `  • Trend: ${trendLabel}${trendSuffix}\n` +
      `  • Setup: ${s.setup.direction} ${s.setup.count}/9${setupSuffix}\n` +
      `  • Countdown: ${s.countdown.count}/13${countdownSuffix}` +
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
