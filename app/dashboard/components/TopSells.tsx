import type { DailyRow } from '../../../lib/notion/queries'

export function TopSells({ data }: { data: DailyRow[] }) {
  const sells = data
    .filter(r => r.setupDirection === 'sell')
    .sort((a, b) => b.setupCount - a.setupCount || b.signalStrength - a.signalStrength)
    .slice(0, 5)

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-rose-400">Top Sell Setups</h2>
      {sells.length === 0 ? (
        <p className="text-xs text-slate-500">No sell setups today.</p>
      ) : (
        <ul className="space-y-2">
          {sells.map(row => (
            <li key={row.ticker} className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm font-medium text-slate-100">{row.ticker}</span>
                <span className="ml-2 text-xs text-slate-400">{row.setupText}</span>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">str {row.signalStrength}</div>
                <div className={`text-xs ${row.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(1)}%
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
