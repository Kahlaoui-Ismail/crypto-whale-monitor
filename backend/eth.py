import asyncio
import os

import httpx

from cache import tx_cache
from config import app_config
from models import Transaction

ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))
API_KEY = os.getenv("ETHERSCAN_API_KEY", "")


async def _fetch_eth_price(client: httpx.AsyncClient) -> float:
    try:
        r = await client.get(
            "https://api.binance.com/api/v3/ticker/price",
            params={"symbol": "ETHUSDT"},
            timeout=10.0,
        )
        return float(r.json()["price"])
    except Exception as exc:
        print(f"[ETH] price fetch error: {exc}")
        return 0.0


async def _fetch_block(client: httpx.AsyncClient, block_hex: str) -> dict:
    r = await client.get(
        ETHERSCAN_BASE,
        params={
            "chainid": "1",
            "module": "proxy",
            "action": "eth_getBlockByNumber",
            "tag": block_hex,
            "boolean": "true",
            "apikey": API_KEY,
        },
        timeout=15.0,
    )
    return r.json().get("result") or {}


async def poll_eth() -> None:
    seen: set[str] = set()
    async with httpx.AsyncClient() as client:
        while True:
            try:
                eth_price = await _fetch_eth_price(client)

                r = await client.get(
                    ETHERSCAN_BASE,
                    params={
                        "chainid": "1",
                        "module": "proxy",
                        "action": "eth_blockNumber",
                        "apikey": API_KEY,
                    },
                    timeout=10.0,
                )
                result = r.json().get("result", "0x0")
                latest = int(result, 16)

                # Scan last 3 blocks to catch anything we may have missed
                for bn in range(latest - 2, latest + 1):
                    block = await _fetch_block(client, hex(bn))
                    if not block:
                        await asyncio.sleep(0.25)
                        continue

                    block_ts = int(block.get("timestamp", "0x0"), 16)

                    for tx in block.get("transactions", []):
                        tx_hash = tx.get("hash", "")
                        if not tx_hash or tx_hash in seen:
                            continue

                        value_hex = tx.get("value", "0x0") or "0x0"
                        wei = int(value_hex, 16)
                        eth = wei / 1e18

                        if eth >= app_config.eth_threshold:
                            seen.add(tx_hash)
                            tx_cache.add(
                                Transaction(
                                    chain="ETH",
                                    hash=tx_hash,
                                    amount=round(eth, 4),
                                    usd_value=round(eth * eth_price, 2),
                                    from_addr=tx.get("from", ""),
                                    to_addr=tx.get("to") or "Contract",
                                    timestamp=block_ts,
                                )
                            )

                    await asyncio.sleep(0.25)  # Stay under Etherscan free-tier limit

            except Exception as exc:
                print(f"[ETH] poll error: {exc}")

            await asyncio.sleep(POLL_INTERVAL)
