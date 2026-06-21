import type { DailyRow } from '../../../lib/notion/queries'

const statusOrder: Record<DailyRow['tdstStatus'], number> = {
  near: 0, approaching: 1, far: 2, broken: 3,
}

export function TDSTRisk({ data }: { data: DailyRow[] }) {
  const atRisk = data
    .filter(r => r.tdstStatus === 'near' || r.tdstStatus === 'approaching')
    .sort((a, b) => statusOrder[a.tdstStatus] - statusOrder[b.tdstStatus] || a.tdstDistancePct - b.tdstDistancePct)

  const statusCls = (s: DailyRow['tdstStatus']) =>
    s === 'near' ? 'text-rose-400' :
    s === 'approaching' ? 'text-amber-400' :
    'text-slate-500'

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-100">
        TDST Risk{' '}
        <span className="font-normal text-slate-500">({atRisk.length} near/approaching)</span>
      </h2>
      {atRisk.length === 0 ? (
        <p className="text-xs text-slate-500">No tickers near TDST levels today.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2 pr-4">Ticker</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Distance</th>
                <th className="py-2 pr-4">Setup</th>
                <th className="py-2 pr-4">PnL</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map(row => (
                <tr key={row.ticker} className="border-b border-slate-900">
                  <td className="py-1.5 pr-4 font-mono font-medium text-slate-100">{row.ticker}</td>
                  <td className={`py-1.5 pr-4 capitalize font-medium ${statusCls(row.tdstStatus)}`}>
                    {row.tdstStatus}
                  </td>
                  <td className="py-1.5 pr-4 text-slate-300">{row.tdstDistancePct.toFixed(2)}%</td>
                  <td className="py-1.5 pr-4 text-slate-400">{row.setupText}</td>
                  <td className={`py-1.5 pr-4 ${row.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
