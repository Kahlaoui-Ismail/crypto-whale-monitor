from pydantic import BaseModel


class Transaction(BaseModel):
    chain: str        # "ETH" or "SOL"
    hash: str
    amount: float
    usd_value: float
    from_addr: str
    to_addr: str
    timestamp: int    # Unix timestamp
