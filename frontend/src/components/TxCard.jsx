import { useState } from 'react';

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── tier classification ───────────────────────────────────────────────────────

function getTier(usd) {
  if (usd >= 5_000_000) return 'mega';
  if (usd >= 500_000)   return 'large';
  return 'standard';
}

const TIER = {
  standard: {
    card:   'bg-gray-900 border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/50',
    amount: 'text-white font-semibold text-base',
    usd:    'text-gray-400 text-sm',
    badge:  null,
    hash:   'text-gray-600 hover:text-gray-400',
  },
  large: {
    card:   'bg-amber-950/30 border-amber-800/50 hover:border-amber-500/70 hover:shadow-xl hover:shadow-amber-950/50',
    amount: 'text-amber-100 font-bold text-base',
    usd:    'text-amber-400 text-sm font-medium',
    badge:  { label: 'LARGE WHALE', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
    hash:   'text-amber-900 hover:text-amber-600',
  },
  mega: {
    card:   'whale-mega border-orange-600/60 hover:border-orange-400/90 hover:shadow-2xl hover:shadow-orange-950/60',
    amount: 'text-orange-100 font-extrabold text-xl',
    usd:    'text-orange-300 text-base font-bold',
    badge:  { label: '🔥 MEGA WHALE', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/50' },
    hash:   'text-orange-900 hover:text-orange-500',
  },
};

// ── CopyAddr ──────────────────────────────────────────────────────────────────

function CopyAddr({ addr, colorClass }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation(); // don't trigger card click
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={addr}
      className={`font-mono text-xs transition-colors cursor-pointer select-none ${colorClass}`}
    >
      {copied ? '✓ copied' : formatAddr(addr)}
    </button>
  );
}

// ── TxCard ────────────────────────────────────────────────────────────────────

export default function TxCard({ tx, isNew }) {
  const isEth = tx.chain === 'ETH';
  const explorerUrl = isEth
    ? `https://etherscan.io/tx/${tx.hash}`
    : `https://solscan.io/tx/${tx.hash}`;

  const tier = getTier(tx.usd_value);
  const t    = TIER[tier];

  const chainBadge = isEth
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-purple-500/20 text-purple-400 border-purple-500/30';

  const addrColor = tier === 'mega'
    ? 'text-orange-400/80 hover:text-orange-200'
    : tier === 'large'
    ? 'text-amber-500/80 hover:text-amber-200'
    : 'text-gray-400 hover:text-gray-100';

  const handleCardClick = () => {
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className={[
        'relative border rounded-xl p-4 cursor-pointer',
        'transition-all duration-200 ease-out',
        '-translate-y-0 hover:-translate-y-1',
        t.card,
        isNew ? 'animate-fadeIn' : '',
      ].join(' ')}
    >
      {/* ── Top row ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tier badge (large / mega only) */}
          {t.badge && (
            <span className={`text-[10px] font-extrabold tracking-widest px-2 py-0.5 rounded-full border ${t.badge.cls}`}>
              {t.badge.label}
            </span>
          )}

          {/* Chain badge */}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${chainBadge}`}>
            {tx.chain}
          </span>

          {/* Amount */}
          <span className={t.amount}>
            {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            &nbsp;<span className="opacity-60 text-sm font-normal">{tx.chain}</span>
          </span>

          {/* USD value */}
          <span className={t.usd}>{fmtUSD(tx.usd_value)}</span>
        </div>

        {/* Time + explorer hint */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-gray-500">{relTime(tx.timestamp)}</span>
          <span className="text-[10px] text-gray-700 group-hover:text-gray-500">↗ view</span>
        </div>
      </div>

      {/* ── Address row ── */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-gray-600">from</span>
        <CopyAddr addr={tx.from_addr} colorClass={addrColor} />
        <span className="text-gray-700 text-xs">→</span>
        <span className="text-[10px] uppercase tracking-widest text-gray-600">to</span>
        <CopyAddr addr={tx.to_addr} colorClass={addrColor} />
      </div>

      {/* ── Hash ── */}
      <div className="mt-2">
        <span className={`font-mono text-[11px] transition-colors ${t.hash}`}>
          {tx.hash.slice(0, 16)}…{tx.hash.slice(-8)}&nbsp;↗
        </span>
      </div>
    </div>
  );
}
