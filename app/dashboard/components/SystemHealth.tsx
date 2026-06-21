import type { DailyRow } from '../../../lib/notion/queries'

export function SystemHealth({ data }: { data: DailyRow[] }) {
  const tickerCount = data.length
  const date = data[0]?.date ?? '—'
  const builtAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  const volCounts = { low: 0, normal: 0, high: 0 }
  for (const r of data) volCounts[r.volatility]++

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-100">System Health</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Signal date</dt>
          <dd className="mt-0.5 font-mono text-slate-200">{date}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tickers processed</dt>
          <dd className="mt-0.5 font-mono text-slate-200">{tickerCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Page built</dt>
          <dd className="mt-0.5 font-mono text-slate-200">{builtAt}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Volatility mix</dt>
          <dd className="mt-0.5 text-slate-300">
            <span className="text-emerald-400">{volCounts.low}L</span>{' / '}
            <span className="text-slate-300">{volCounts.normal}N</span>{' / '}
            <span className="text-rose-400">{volCounts.high}H</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
