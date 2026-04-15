function fmtUSD(val) {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function StatCard({ label, value, sub, accentClass = 'text-white' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function StatsBar({ transactions }) {
  const nowSec    = Math.floor(Date.now() / 1000);
  const recent    = transactions.filter((t) => t.timestamp >= nowSec - 3600);

  const largest   = recent.reduce(
    (max, t) => (t.usd_value > (max?.usd_value ?? 0) ? t : max),
    null
  );

  const ethCount  = transactions.filter((t) => t.chain === 'ETH').length;
  const solCount  = transactions.filter((t) => t.chain === 'SOL').length;

  const largestLabel = largest
    ? fmtUSD(largest.usd_value)
    : '—';
  const largestSub = largest
    ? `${largest.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${largest.chain}`
    : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Seen"
        value={transactions.length.toString()}
      />
      <StatCard
        label="Largest (1 h)"
        value={largestLabel}
        sub={largestSub}
      />
      <StatCard
        label="ETH Txns"
        value={ethCount.toString()}
        accentClass="text-blue-400"
      />
      <StatCard
        label="SOL Txns"
        value={solCount.toString()}
        accentClass="text-purple-400"
      />
    </div>
  );
}
