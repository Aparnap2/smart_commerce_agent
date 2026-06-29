"""Security - Input validation and audit logging."""
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from loguru import logger

class ToolInputValidator(BaseModel):
    """Base validator for all tool inputs."""

    @validator('*', pre=True)
    def strip_whitespace(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

class SearchInput(ToolInputValidator):
    query: str = Field(..., min_length=1, max_length=500)

    @validator('query')
    def validate_query(cls, v):
        if any(char in v for char in ['<', '>', '"', "'", ';', '--']):
            raise ValueError("Invalid characters in query")
        return v

class CaseInput(ToolInputValidator):
    case_id: str = Field(..., pattern=r'^[A-Za-z0-9]+$')
    subject: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)

class AuditLogger:
    """Audit trail for all agent actions."""

    @staticmethod
    def log_action(user_id: str, action: str, tool: str, result: str):
        logger.info(f"AUDIT | user={user_id} | action={action} | tool={tool} | result={result[:100]}")

    @staticmethod
    def log_security_event(event_type: str, details: str):
        logger.warning(f"SECURITY | type={event_type} | details={details}")
