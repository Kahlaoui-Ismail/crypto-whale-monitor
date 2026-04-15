const INTERVALS = [
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m',  ms: 60_000 },
  { label: '5m',  ms: 300_000 },
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

const SLIDER_CONFIG = {
  ETH: { min: 0.1, max: 500,   color: '#60a5fa', unit: 'ETH' },
  SOL: { min: 1,   max: 10000, color: '#c084fc', unit: 'SOL' },
};

// ── Log-scale helpers ──────────────────────────────────────────────────────────
// The slider thumb moves 0–100 linearly, but maps to values on a log10 scale.
// This gives fine-grained control at low thresholds and still reaches high ones.

function sliderToValue(pos, min, max) {
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  return Math.pow(10, logMin + (pos / 100) * (logMax - logMin));
}

function valueToSlider(val, min, max) {
  const logMin = Math.log10(Math.max(val, min));
  const logMax = Math.log10(max);
  const logMinBound = Math.log10(min);
  return Math.min(100, Math.max(0, ((logMin - logMinBound) / (logMax - logMinBound)) * 100));
}

function fmtValue(val, unit) {
  if (unit === 'ETH') {
    return val < 1 ? `${val.toFixed(2)}` : val < 10 ? `${val.toFixed(1)}` : `${Math.round(val)}`;
  }
  if (val >= 1000) return `${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}K`;
  return `${Math.round(val)}`;
}

// ── ThresholdSlider ────────────────────────────────────────────────────────────

function ThresholdSlider({ chain, value, onChange }) {
  const { min, max, color, unit } = SLIDER_CONFIG[chain];
  const pos = valueToSlider(value, min, max);

  const handleChange = (e) => {
    const raw = sliderToValue(parseFloat(e.target.value), min, max);
    // Round to avoid floating-point noise: 2 decimals for ETH, 0 for SOL
    const rounded = unit === 'ETH' ? Math.round(raw * 100) / 100 : Math.round(raw);
    onChange(rounded);
  };

  const trackStyle = {
    background: `linear-gradient(to right, ${color} ${pos}%, #1f2937 ${pos}%)`,
  };

  const fmtMin = fmtValue(min, unit);
  const fmtMax = fmtValue(max, unit);

  return (
    <div className="flex-1 min-w-[160px]">
      {/* Label row */}
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color }}
        >
          {chain} threshold
        </span>
        <span
          className="text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg"
          style={{ color, background: `${color}18` }}
        >
          ≥ {fmtValue(value, unit)} <span className="text-[10px] font-normal opacity-70">{unit}</span>
        </span>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={pos}
          onChange={handleChange}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer focus:outline-none"
          style={{ ...trackStyle, accentColor: color, '--thumb-color': color }}
        />
      </div>

      {/* Min / max labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-600">{fmtMin} {unit}</span>
        <span className="text-[10px] text-gray-600">{fmtMax} {unit}</span>
      </div>
    </div>
  );
}

// ── SettingsBar ────────────────────────────────────────────────────────────────

export default function SettingsBar({
  enabledChains, onToggleChain,
  pollMs, onChangePoll,
  ethThreshold, onChangeEthThreshold,
  solThreshold, onChangeSolThreshold,
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

      {/* ── Row 1: chains + refresh ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 border-b border-gray-800">

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

        <div className="flex items-center gap-2 ml-auto">
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

      {/* ── Row 2: threshold sliders ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-4 py-4">
        <ThresholdSlider
          chain="ETH"
          value={ethThreshold}
          onChange={onChangeEthThreshold}
        />
        <ThresholdSlider
          chain="SOL"
          value={solThreshold}
          onChange={onChangeSolThreshold}
        />
      </div>
    </div>
  );
}
