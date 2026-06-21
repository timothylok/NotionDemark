import type { DailyRow } from '../../../lib/notion/queries'

export function TrendHeatmap({ data }: { data: DailyRow[] }) {
  const sorted = [...data].sort((a, b) => a.ticker.localeCompare(b.ticker))

  const cellCls = (trend: DailyRow['trend']) =>
    trend === 'up' ? 'bg-emerald-500/25 border-emerald-700/40 text-emerald-300' :
    trend === 'down' ? 'bg-rose-500/25 border-rose-700/40 text-rose-300' :
    'bg-slate-800/50 border-slate-700/40 text-slate-400'

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-100">Trend Heatmap</h2>
      {data.length === 0 ? (
        <p className="text-xs text-slate-500">No data.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sorted.map(row => (
            <div
              key={row.ticker}
              className={`rounded border px-3 py-1.5 text-xs font-mono font-medium ${cellCls(row.trend)}`}
              title={`${row.ticker}: ${row.trend} · strength ${row.signalStrength}`}
            >
              {row.ticker}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/50" />Up</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-500/50" />Down</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-slate-600" />Neutral</span>
      </div>
    </div>
  )
}
