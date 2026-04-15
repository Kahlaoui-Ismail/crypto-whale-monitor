import asyncio
import os
import time

import httpx

from cache import tx_cache
from models import Transaction

SOL_RPC = "https://api.mainnet-beta.solana.com"
SOL_THRESHOLD = float(os.getenv("SOL_THRESHOLD", "10000"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))
LAMPORTS = 1_000_000_000


async def _fetch_sol_price(client: httpx.AsyncClient) -> float:
    try:
        r = await client.get(
            "https://api.binance.com/api/v3/ticker/price",
            params={"symbol": "SOLUSDT"},
            timeout=10.0,
        )
        return float(r.json()["price"])
    except Exception as exc:
        print(f"[SOL] price fetch error: {exc}")
        return 0.0


async def _rpc(client: httpx.AsyncClient, method: str, params: list) -> dict:
    r = await client.post(
        SOL_RPC,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        headers={"Content-Type": "application/json"},
        timeout=20.0,
    )
    return r.json()


async def poll_sol() -> None:
    seen: set[str] = set()
    async with httpx.AsyncClient() as client:
        while True:
            try:
                sol_price = await _fetch_sol_price(client)

                slot_resp = await _rpc(client, "getSlot", [])
                current_slot: int = slot_resp.get("result", 0)

                # Scan the last 10 slots; many may be skipped in Solana
                for slot in range(current_slot - 10, current_slot + 1):
                    try:
                        resp = await _rpc(
                            client,
                            "getBlock",
                            [
                                slot,
                                {
                                    "encoding": "json",
                                    "transactionDetails": "full",
                                    "rewards": False,
                                    "maxSupportedTransactionVersion": 0,
                                },
                            ],
                        )

                        if resp.get("error") or not resp.get("result"):
                            await asyncio.sleep(1.0)
                            continue

                        block = resp["result"]
                        block_time: int = block.get("blockTime") or int(time.time())

                        for tx_data in block.get("transactions", []):
                            meta = tx_data.get("meta") or {}
                            tx = tx_data.get("transaction") or {}
                            msg = tx.get("message") or {}

                            sigs = tx.get("signatures", [])
                            if not sigs:
                                continue
                            sig = sigs[0]
                            if sig in seen:
                                continue

                            pre = meta.get("preBalances", [])
                            post = meta.get("postBalances", [])
                            keys = msg.get("accountKeys", [])

                            for i, (p, q) in enumerate(zip(pre, post)):
                                delta_lamports = p - q  # positive = SOL left this account
                                sol_amount = delta_lamports / LAMPORTS
                                if sol_amount < SOL_THRESHOLD:
                                    continue

                                seen.add(sig)
                                from_addr = keys[i] if i < len(keys) else "unknown"

                                # Largest positive delta is the receiver
                                to_addr = "unknown"
                                max_gain = 0
                                for j, (a, b) in enumerate(zip(pre, post)):
                                    gain = b - a
                                    if gain > max_gain:
                                        max_gain = gain
                                        to_addr = keys[j] if j < len(keys) else "unknown"

                                tx_cache.add(
                                    Transaction(
                                        chain="SOL",
                                        hash=sig,
                                        amount=round(sol_amount, 2),
                                        usd_value=round(sol_amount * sol_price, 2),
                                        from_addr=from_addr,
                                        to_addr=to_addr,
                                        timestamp=block_time,
                                    )
                                )
                                break  # one entry per transaction

                        await asyncio.sleep(1.0)  # Public RPC rate limit

                    except Exception as exc:
                        print(f"[SOL] slot {slot} error: {exc}")
                        await asyncio.sleep(1.0)

            except Exception as exc:
                print(f"[SOL] poll error: {exc}")

            await asyncio.sleep(POLL_INTERVAL)
