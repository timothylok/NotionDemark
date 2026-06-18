import { TickerSignal } from '../types'

export async function postSummary(signals: TickerSignal[]): Promise<void> {
  const lines = signals.map(s => {
    const tdstLine = s.tdst
      ? `\n  • TDST ${s.tdst.direction === 'buy' ? 'Support' : 'Resistance'}: ${s.tdst.level.toFixed(2)} ` +
        `(${s.tdst.broken ? 'broken' : 'respected'}, dist ${((s.close - s.tdst.level) / s.tdst.level * 100).toFixed(1)}%)`
      : ''
    return (
      `${s.ticker}: Close ${s.close.toFixed(2)} (${s.pnlPct.toFixed(2)}%) vs Avg ${s.avgCost.toFixed(2)}\n` +
      `  • Setup: ${s.setup.direction} ${s.setup.count}/9\n` +
      `  • Countdown: ${s.countdown.count}/13` +
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
