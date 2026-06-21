import type { DailyRow } from '../../../lib/notion/queries'

export function TopBuys({ data }: { data: DailyRow[] }) {
  const buys = data
    .filter(r => r.setupDirection === 'buy')
    .sort((a, b) => b.setupCount - a.setupCount || b.signalStrength - a.signalStrength)
    .slice(0, 5)

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-emerald-400">Top Buy Setups</h2>
      {buys.length === 0 ? (
        <p className="text-xs text-slate-500">No buy setups today.</p>
      ) : (
        <ul className="space-y-2">
          {buys.map(row => (
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
