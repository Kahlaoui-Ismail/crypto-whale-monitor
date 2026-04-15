import asyncio
import os
from contextlib import asynccontextmanager
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from cache import tx_cache  # noqa: E402 — must load env before importing pollers
from eth import poll_eth
from models import Transaction
from sol import poll_sol


@asynccontextmanager
async def lifespan(app: FastAPI):
    eth_task = asyncio.create_task(poll_eth())
    sol_task = asyncio.create_task(poll_sol())
    yield
    eth_task.cancel()
    sol_task.cancel()
    await asyncio.gather(eth_task, sol_task, return_exceptions=True)


app = FastAPI(title="Crypto Whale Monitor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/transactions", response_model=List[Transaction])
async def get_transactions():
    return tx_cache.get_all()


@app.get("/health")
async def health():
    txns = tx_cache.get_all()
    return {
        "status": "ok",
        "cached": len(txns),
        "eth_threshold": os.getenv("ETH_THRESHOLD", "100"),
        "sol_threshold": os.getenv("SOL_THRESHOLD", "10000"),
    }
