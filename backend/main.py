import asyncio
import os
from contextlib import asynccontextmanager
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from cache import tx_cache  # noqa: E402 — must load env before importing pollers
from config import app_config
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
    allow_methods=["GET", "PATCH"],
    allow_headers=["*"],
)


class ThresholdUpdate(BaseModel):
    eth_threshold: Optional[float] = None
    sol_threshold: Optional[float] = None


@app.get("/api/transactions", response_model=List[Transaction])
async def get_transactions():
    return tx_cache.get_all()


@app.get("/api/settings")
async def get_settings():
    return {
        "eth_threshold": app_config.eth_threshold,
        "sol_threshold": app_config.sol_threshold,
    }


@app.patch("/api/settings")
async def update_settings(body: ThresholdUpdate):
    if body.eth_threshold is not None and body.eth_threshold > 0:
        app_config.eth_threshold = body.eth_threshold
    if body.sol_threshold is not None and body.sol_threshold > 0:
        app_config.sol_threshold = body.sol_threshold
    return {
        "eth_threshold": app_config.eth_threshold,
        "sol_threshold": app_config.sol_threshold,
    }


@app.get("/health")
async def health():
    txns = tx_cache.get_all()
    return {
        "status": "ok",
        "cached": len(txns),
        "eth_threshold": app_config.eth_threshold,
        "sol_threshold": app_config.sol_threshold,
    }
