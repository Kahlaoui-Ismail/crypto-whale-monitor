import os


class AppConfig:
    def __init__(self):
        self.eth_threshold = float(os.getenv("ETH_THRESHOLD", "100"))
        self.sol_threshold = float(os.getenv("SOL_THRESHOLD", "10000"))


app_config = AppConfig()
