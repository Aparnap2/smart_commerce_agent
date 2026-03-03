from enum import Enum


class ErrorCode(str, Enum):
    OUT_OF_STOCK = "INVENTORY_001"
    PAYMENT_FAILED = "PAYMENT_001"
    FORBIDDEN = "AUTH_001"
    LLM_TIMEOUT = "AGENT_001"
    TOOL_EXECUTION_FAILED = "AGENT_003"


class CommerceError(Exception):
    def __init__(
        self, code: ErrorCode, message: str, retryable: bool, http_status: int
    ):
        self.code = code
        self.retryable = retryable
        self.http_status = http_status
        super().__init__(message)
