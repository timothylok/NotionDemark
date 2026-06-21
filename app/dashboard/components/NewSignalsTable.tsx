import type { DailyRow } from '../../../lib/notion/queries'

function TrendPill({ trend }: { trend: DailyRow['trend'] }) {
  const cls =
    trend === 'up' ? 'bg-emerald-500/20 text-emerald-300' :
    trend === 'down' ? 'bg-rose-500/20 text-rose-300' :
    'bg-slate-500/20 text-slate-400'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${cls}`}>{trend}</span>
  )
}

export function NewSignalsTable({ data }: { data: DailyRow[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-100">All Signals Today</h2>
      {data.length === 0 ? (
        <p className="text-xs text-slate-500">No signals for today yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2 pr-4">Ticker</th>
                <th className="py-2 pr-4">Setup</th>
                <th className="py-2 pr-4">Countdown</th>
                <th className="py-2 pr-4">Trend</th>
                <th className="py-2 pr-4">Strength</th>
                <th className="py-2 pr-4">PnL</th>
                <th className="py-2 pr-4">ATR%</th>
                <th className="py-2 pr-4">Vol</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.ticker} className="border-b border-slate-900 hover:bg-slate-900/40">
                  <td className="py-1.5 pr-4 font-mono font-medium text-slate-100">{row.ticker}</td>
                  <td className="py-1.5 pr-4 text-slate-300">{row.setupText}</td>
                  <td className="py-1.5 pr-4 text-slate-400">{row.countdownText}</td>
                  <td className="py-1.5 pr-4"><TrendPill trend={row.trend} /></td>
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 rounded-full bg-slate-800">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${row.signalStrength}%` }}
                        />
                      </div>
                      <span className="text-slate-400">{row.signalStrength}</span>
                    </div>
                  </td>
                  <td className={`py-1.5 pr-4 ${row.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(1)}%
                  </td>
                  <td className="py-1.5 pr-4 text-slate-400">{row.atrPct.toFixed(2)}%</td>
                  <td className="py-1.5 pr-4 text-slate-500 capitalize">{row.volatility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
