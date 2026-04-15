import { useState } from 'react';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatAddr(addr) {
  if (!addr || addr.length < 12) return addr || 'unknown';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relTime(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtUSD(val) {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function CopyAddr({ addr }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={addr}
      className="font-mono text-xs text-gray-400 hover:text-gray-100 transition-colors cursor-pointer select-none"
    >
      {copied ? '✓ copied' : formatAddr(addr)}
    </button>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function TxCard({ tx, isNew }) {
  const isEth      = tx.chain === 'ETH';
  const explorerUrl = isEth
    ? `https://etherscan.io/tx/${tx.hash}`
    : `https://solscan.io/tx/${tx.hash}`;

  const badgeClass = isEth
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-purple-500/20 text-purple-400 border-purple-500/30';

  return (
    <div
      className={[
        'bg-gray-900 border border-gray-800 rounded-xl p-4',
        'hover:border-gray-700 transition-colors',
        isNew ? 'animate-fadeIn' : '',
      ].join(' ')}
    >
      {/* ── Top row ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
            {tx.chain}
          </span>

          <span className="font-semibold text-white">
            {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            &nbsp;{tx.chain}
          </span>

          <span className="text-gray-400 text-sm">{fmtUSD(tx.usd_value)}</span>
        </div>

        <span className="text-xs text-gray-500 shrink-0 mt-0.5">{relTime(tx.timestamp)}</span>
      </div>

      {/* ── Address row ── */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-gray-600">from</span>
        <CopyAddr addr={tx.from_addr} />
        <span className="text-gray-700 text-xs">→</span>
        <span className="text-[10px] uppercase tracking-widest text-gray-600">to</span>
        <CopyAddr addr={tx.to_addr} />
      </div>

      {/* ── Hash link ── */}
      <div className="mt-2">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          {tx.hash.slice(0, 16)}…{tx.hash.slice(-8)}&nbsp;↗
        </a>
      </div>
    </div>
  );
}
