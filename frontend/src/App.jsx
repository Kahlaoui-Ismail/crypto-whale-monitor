import { useState, useEffect, useRef, useCallback } from 'react';
import TxCard from './components/TxCard';
import StatsBar from './components/StatsBar';
import SettingsBar from './components/SettingsBar';

const DEFAULT_POLL_MS = 30_000;

// Empty string locally (nginx proxy handles /api/*).
// Set VITE_API_BASE=https://crypto-whale-monitor-api.onrender.com on Render.
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// ── Notifications ─────────────────────────────────────────────────────────────

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendWhaleAlert(tx) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const usd = tx.usd_value > 0 ? ` ($${tx.usd_value.toLocaleString()})` : '';
  new Notification(`🐋 Whale Alert — ${tx.chain}`, {
    body: `${tx.amount.toLocaleString()} ${tx.chain}${usd}\nFrom: ${tx.from_addr.slice(0, 10)}…`,
    icon: '/favicon.ico',
  });
}

// ── Sound ─────────────────────────────────────────────────────────────────────

function playWhaleSound(isMega = false) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = 'sine';
    osc.frequency.value = isMega ? 660 : 440;
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
    if (isMega) {
      const osc2 = ctx.createOscillator();
      osc2.connect(gain);
      osc2.type            = 'sine';
      osc2.frequency.value = 880;
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.7);
    }
  } catch (_) {}
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(transactions) {
  const headers = ['Chain', 'Hash', 'Amount', 'USD Value', 'From', 'To', 'Timestamp'];
  const rows = transactions.map((tx) => [
    tx.chain,
    tx.hash,
    tx.amount,
    tx.usd_value,
    tx.from_addr,
    tx.to_addr,
    new Date(tx.timestamp * 1000).toISOString(),
  ]);
  const csv  = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `whale-txns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Icon buttons ──────────────────────────────────────────────────────────────

function IconBtn({ onClick, title, active, activeClass = 'text-white', children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'w-8 h-8 flex items-center justify-center rounded-lg border transition-all text-sm',
        active
          ? `bg-gray-700 border-gray-600 ${activeClass}`
          : 'bg-transparent border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [transactions, setTransactions]   = useState([]);
  const [newHashes, setNewHashes]         = useState(new Set());
  const [lastUpdated, setLastUpdated]     = useState(null);
  const [isLive, setIsLive]               = useState(true);
  const [enabledChains, setEnabledChains] = useState(new Set(['ETH', 'SOL']));
  const [pollMs, setPollMs]               = useState(DEFAULT_POLL_MS);
  const [ethThreshold, setEthThreshold]   = useState(1);
  const [solThreshold, setSolThreshold]   = useState(100);
  const [soundOn, setSoundOn]             = useState(false);
  const [search, setSearch]               = useState('');
  const prevHashes                         = useRef(new Set());
  const isFirstFetch                       = useRef(true);

  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((d) => { setEthThreshold(d.eth_threshold); setSolThreshold(d.sol_threshold); })
      .catch(() => {});
  }, []);

  const handleToggleChain = useCallback((chain) => {
    setEnabledChains((prev) => {
      if (prev.has(chain) && prev.size === 1) return prev;
      const next = new Set(prev);
      next.has(chain) ? next.delete(chain) : next.add(chain);
      return next;
    });
  }, []);

  const patchThreshold = useCallback((patch) => {
    fetch(`${API_BASE}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
      .then((r) => r.json())
      .then((d) => { setEthThreshold(d.eth_threshold); setSolThreshold(d.sol_threshold); })
      .catch(() => {});
  }, []);

  const handleChangeEthThreshold = useCallback((val) => {
    setEthThreshold(val); patchThreshold({ eth_threshold: val });
  }, [patchThreshold]);

  const handleChangeSolThreshold = useCallback((val) => {
    setSolThreshold(val); patchThreshold({ sol_threshold: val });
  }, [patchThreshold]);

  const fetchTxns = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/transactions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const incoming = new Set(data.map((t) => t.hash));
      const fresh    = new Set([...incoming].filter((h) => !prevHashes.current.has(h)));

      if (!isFirstFetch.current && fresh.size > 0) {
        const newTxs = data.filter((tx) => fresh.has(tx.hash));
        newTxs.forEach(sendWhaleAlert);
        if (soundOn) {
          const hasMega = newTxs.some((tx) => tx.usd_value >= 5_000_000);
          playWhaleSound(hasMega);
        }
      }
      isFirstFetch.current = false;

      prevHashes.current = incoming;
      setNewHashes(fresh);
      setTransactions(data);
      setLastUpdated(Date.now());
      setIsLive(true);
      setTimeout(() => setNewHashes(new Set()), 1500);
    } catch (err) {
      console.error('[whale] fetch error:', err);
      setIsLive(false);
    }
  }, [soundOn]);

  useEffect(() => {
    fetchTxns();
    const id = setInterval(fetchTxns, pollMs);
    return () => clearInterval(id);
  }, [fetchTxns, pollMs]);

  // ── filtered list ──────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const afterChainAndThreshold = transactions.filter(
    (tx) =>
      enabledChains.has(tx.chain) &&
      (tx.chain === 'ETH' ? tx.amount >= ethThreshold : tx.amount >= solThreshold),
  );
  const visible = q
    ? afterChainAndThreshold.filter(
        (tx) =>
          tx.from_addr.toLowerCase().includes(q) ||
          tx.to_addr.toLowerCase().includes(q) ||
          tx.hash.toLowerCase().includes(q),
      )
    : afterChainAndThreshold;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">

          {/* Logo */}
          <span className="text-xl font-bold tracking-tight shrink-0">🐋 Whale Monitor</span>

          {/* Network pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {['ETH', 'SOL'].map((chain) => (
              <span
                key={chain}
                className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 bg-gray-800/80 px-2.5 py-1 rounded-full border border-gray-700"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                {chain}
              </span>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Toolbar */}
          <div className="flex items-center gap-1.5">
            {/* Sound */}
            <IconBtn
              onClick={() => setSoundOn((v) => !v)}
              title={soundOn ? 'Mute alerts' : 'Enable sound alerts'}
              active={soundOn}
              activeClass="text-yellow-300"
            >
              {soundOn ? '🔔' : '🔕'}
            </IconBtn>

            {/* Export */}
            <IconBtn
              onClick={() => exportCSV(visible)}
              title="Export visible transactions as CSV"
            >
              ↓
            </IconBtn>

            {/* Live indicator */}
            <div className="flex items-center gap-1.5 ml-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={isLive ? 'text-green-400' : 'text-red-400'}>
                {isLive ? 'Live' : 'Disconnected'}
              </span>
              {lastUpdated && (
                <span className="text-gray-600 text-xs hidden md:inline">
                  · {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        <StatsBar transactions={transactions} />

        <div className="mt-4">
          <SettingsBar
            enabledChains={enabledChains}
            onToggleChain={handleToggleChain}
            pollMs={pollMs}
            onChangePoll={setPollMs}
            ethThreshold={ethThreshold}
            onChangeEthThreshold={handleChangeEthThreshold}
            solThreshold={solThreshold}
            onChangeSolThreshold={handleChangeSolThreshold}
          />
        </div>

        {/* ── Search bar ── */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Filter by address or tx hash…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-700 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Count badge */}
          <span className="shrink-0 text-xs text-gray-500 tabular-nums">
            {visible.length > 0 ? (
              <>
                <span className="text-gray-300 font-medium">{visible.length}</span>
                {visible.length !== afterChainAndThreshold.length && (
                  <> / {afterChainAndThreshold.length}</>
                )}
                {' '}txn{visible.length !== 1 ? 's' : ''}
              </>
            ) : null}
          </span>
        </div>

        {/* ── Transaction list ── */}
        <div className="mt-3 space-y-3">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-gray-600">
              <span className="text-5xl mb-4">🐋</span>
              {q ? (
                <>
                  <p className="text-lg">No transactions match</p>
                  <p className="text-sm mt-2 font-mono text-gray-700">"{search}"</p>
                </>
              ) : (
                <>
                  <p className="text-lg">Scanning for whale transactions…</p>
                  <p className="text-sm mt-2">
                    Refreshing every {pollMs >= 60_000 ? `${pollMs / 60_000}m` : `${pollMs / 1000}s`}
                  </p>
                </>
              )}
            </div>
          ) : (
            visible.map((tx) => (
              <TxCard key={tx.hash} tx={tx} isNew={newHashes.has(tx.hash)} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
