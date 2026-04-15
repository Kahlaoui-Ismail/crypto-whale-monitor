import { useState, useEffect, useRef, useCallback } from 'react';
import TxCard from './components/TxCard';
import StatsBar from './components/StatsBar';
import SettingsBar from './components/SettingsBar';

const DEFAULT_POLL_MS = 30_000;

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

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [newHashes, setNewHashes]       = useState(new Set());
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [isLive, setIsLive]             = useState(true);
  const [enabledChains, setEnabledChains] = useState(new Set(['ETH', 'SOL']));
  const [pollMs, setPollMs]             = useState(DEFAULT_POLL_MS);
  const prevHashes                       = useRef(new Set());
  const isFirstFetch                     = useRef(true);

  useEffect(() => { requestNotificationPermission(); }, []);

  const handleToggleChain = useCallback((chain) => {
    setEnabledChains((prev) => {
      // Keep at least one chain enabled
      if (prev.has(chain) && prev.size === 1) return prev;
      const next = new Set(prev);
      next.has(chain) ? next.delete(chain) : next.add(chain);
      return next;
    });
  }, []);

  const fetchTxns = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const incoming = new Set(data.map((t) => t.hash));
      const fresh    = new Set([...incoming].filter((h) => !prevHashes.current.has(h)));

      // Don't fire notifications on the initial load — only for genuinely new arrivals
      if (!isFirstFetch.current && fresh.size > 0) {
        data
          .filter((tx) => fresh.has(tx.hash))
          .forEach(sendWhaleAlert);
      }
      isFirstFetch.current = false;

      prevHashes.current = incoming;
      setNewHashes(fresh);
      setTransactions(data);
      setLastUpdated(Date.now());
      setIsLive(true);

      // Remove highlight after animation completes
      setTimeout(() => setNewHashes(new Set()), 1500);
    } catch (err) {
      console.error('[whale] fetch error:', err);
      setIsLive(false);
    }
  }, []);

  useEffect(() => {
    fetchTxns();
    const id = setInterval(fetchTxns, pollMs);
    return () => clearInterval(id);
  }, [fetchTxns, pollMs]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-2xl font-bold tracking-tight">🐋 Whale Monitor</span>

          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className={isLive ? 'text-green-400' : 'text-red-400'}>
              {isLive ? 'Live' : 'Disconnected'}
            </span>
            {lastUpdated && (
              <span className="text-gray-600 ml-3 text-xs">
                updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
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
          />
        </div>

        <div className="mt-4 space-y-3">
          {(() => {
            const visible = transactions.filter((tx) => enabledChains.has(tx.chain));
            if (visible.length === 0) return (
              <div className="flex flex-col items-center justify-center py-32 text-gray-600">
                <span className="text-5xl mb-4">🐋</span>
                <p className="text-lg">Scanning for whale transactions…</p>
                <p className="text-sm mt-2">
                  Refreshing every {pollMs >= 60_000 ? `${pollMs / 60_000}m` : `${pollMs / 1000}s`}
                </p>
              </div>
            );
            return visible.map((tx) => (
              <TxCard key={tx.hash} tx={tx} isNew={newHashes.has(tx.hash)} />
            ));
          })()}
        </div>
      </main>
    </div>
  );
}
