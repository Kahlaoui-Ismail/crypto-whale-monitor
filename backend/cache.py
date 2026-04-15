from collections import deque
from threading import Lock
from typing import List

from models import Transaction


class TransactionCache:
    def __init__(self, maxlen: int = 100):
        self._cache: deque = deque(maxlen=maxlen)
        self._lock = Lock()
        self._seen: set = set()

    def add(self, tx: Transaction) -> bool:
        with self._lock:
            if tx.hash in self._seen:
                return False
            self._seen.add(tx.hash)
            self._cache.appendleft(tx)
            return True

    def get_all(self) -> List[Transaction]:
        with self._lock:
            return list(self._cache)


tx_cache = TransactionCache()
