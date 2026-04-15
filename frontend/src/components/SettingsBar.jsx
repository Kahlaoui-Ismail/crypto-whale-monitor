const INTERVALS = [
  { label: '10s',  ms: 10_000 },
  { label: '30s',  ms: 30_000 },
  { label: '1m',   ms: 60_000 },
  { label: '5m',   ms: 300_000 },
];

const CHAINS = ['ETH', 'SOL'];

const CHAIN_STYLES = {
  ETH: {
    on:  'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:border-blue-400',
    off: 'bg-transparent text-gray-600 border-gray-700 hover:border-gray-500 hover:text-gray-400',
  },
  SOL: {
    on:  'bg-purple-500/20 text-purple-400 border-purple-500/40 hover:border-purple-400',
    off: 'bg-transparent text-gray-600 border-gray-700 hover:border-gray-500 hover:text-gray-400',
  },
};

export default function SettingsBar({ enabledChains, onToggleChain, pollMs, onChangePoll }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl">

      {/* ── Chain filters ── */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">Chains</span>
        <div className="flex gap-1.5">
          {CHAINS.map((chain) => {
            const active = enabledChains.has(chain);
            return (
              <button
                key={chain}
                onClick={() => onToggleChain(chain)}
                className={[
                  'px-3 py-1 text-xs font-bold rounded-full border transition-all',
                  active ? CHAIN_STYLES[chain].on : CHAIN_STYLES[chain].off,
                ].join(' ')}
              >
                {chain}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-px h-5 bg-gray-800 hidden sm:block" />

      {/* ── Poll interval ── */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">Refresh</span>
        <div className="flex gap-1">
          {INTERVALS.map(({ label, ms }) => {
            const active = pollMs === ms;
            return (
              <button
                key={ms}
                onClick={() => onChangePoll(ms)}
                className={[
                  'px-2.5 py-1 text-xs rounded-lg border transition-all',
                  active
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-transparent text-gray-500 border-gray-800 hover:border-gray-600 hover:text-gray-300',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
