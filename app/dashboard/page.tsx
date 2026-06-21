import { getDailySignals } from '../../lib/notion/queries'
import { NewSignalsTable } from './components/NewSignalsTable'
import { TopBuys } from './components/TopBuys'
import { TopSells } from './components/TopSells'
import { TrendHeatmap } from './components/TrendHeatmap'
import { TDSTRisk } from './components/TDSTRisk'
import { SystemHealth } from './components/SystemHealth'

export const dynamic = 'force-static'

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getDailySignals>> = []
  try {
    data = await getDailySignals()
  } catch {
    // Notion unavailable at build time or env vars not set
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">DeMark Daily Command Center</h1>
        <span className="text-[11px] text-slate-500">
          {data[0]?.date ?? '—'} · {data.length} tickers
        </span>
      </header>

      <main className="space-y-4">
        <NewSignalsTable data={data} />

        <div className="grid gap-4 md:grid-cols-2">
          <TopBuys data={data} />
          <TopSells data={data} />
        </div>

        <TrendHeatmap data={data} />
        <TDSTRisk data={data} />
        <SystemHealth data={data} />
      </main>
    </div>
  )
}
