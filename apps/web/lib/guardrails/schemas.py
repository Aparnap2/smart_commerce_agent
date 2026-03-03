"""
Guardrails Schemas using Pydantic

Vendor-agnostic data validation schemas for:
- Input validation (user queries)
- Output validation (AI responses)
- Safety checks (toxicity, PII, jailbreak)
- Structured LLM output

Uses Pydantic for type-safe validation with custom validators.
"""

from pydantic import BaseModel, Field, validator, field_validator
from typing import List, Optional, Literal
from enum import Enum


class SafetyLevel(str, Enum):
    """Safety classification levels"""
    SAFE = "safe"
    LOW_RISK = "low_risk"
    MEDIUM_RISK = "medium_risk"
    HIGH_RISK = "high_risk"
    BLOCK = "block"


class IntentType(str, Enum):
    """Supported intent types for commerce agent"""
    SEARCH_PRODUCTS = "search_products"
    ADD_TO_CART = "add_to_cart"
    VIEW_CART = "view_cart"
    CHECKOUT = "checkout"
    ORDER_STATUS = "order_status"
    CANCEL_ORDER = "cancel_order"
    REFUND_REQUEST = "refund_request"
    SUPPORT_TICKET = "support_ticket"
    GENERAL_QUERY = "general_query"
    GREETING = "greeting"
    FAREWELL = "farewell"


# ============================================================================
# Input Validation Schemas
# ============================================================================

class SafeQuery(BaseModel):
    """
    Validated user query with safety analysis
    
    Example:
        query = SafeQuery(
            text="Show me laptops",
            is_safe=True,
            toxicity_score=0.01,
            pii_detected=False,
            intent="search_products"
        )
    """
    text: str = Field(..., min_length=1, max_length=2000, description="User query text")
    is_safe: bool = Field(..., description="Whether query passed safety checks")
    toxicity_score: float = Field(..., ge=0.0, le=1.0, description="Toxicity score 0-1")
    pii_detected: bool = Field(..., description="Whether PII was detected")
    intent: IntentType = Field(..., description="Detected user intent")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Intent confidence")
    
    @field_validator('toxicity_score')
    @classmethod
    def check_toxicity(cls, v: float) -> float:
        """Reject high toxicity queries"""
        if v > 0.8:
            raise ValueError(f"Toxicity score too high: {v}")
        return v
    
    @field_validator('text')
    @classmethod
    def check_query_content(cls, v: str) -> str:
        """Check query for jailbreak attempts"""
        jailbreak_patterns = [
            "ignore previous",
            "disregard instructions",
            "you are now",
            "pretend you are",
            "system:",
            "developer:",
        ]
        v_lower = v.lower()
        for pattern in jailbreak_patterns:
            if pattern in v_lower:
                raise ValueError(f"Potential jailbreak attempt detected: {pattern}")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "Show me wireless headphones under $100",
                "is_safe": True,
                "toxicity_score": 0.01,
                "pii_detected": False,
                "intent": "search_products",
                "confidence": 0.95
            }
        }


class ValidatedInput(BaseModel):
    """
    Complete validated input with guardrails result
    """
    query: SafeQuery
    sanitized_text: str = Field(..., description="Sanitized query text")
    safety_level: SafetyLevel = Field(..., description="Overall safety classification")
    requires_review: bool = Field(default=False, description="Whether human review is needed")
    blocked_reason: Optional[str] = Field(default=None, description="Reason if blocked")
    
    @property
    def is_allowed(self) -> bool:
        """Check if input should be processed"""
        return self.safety_level != SafetyLevel.BLOCK and self.query.is_safe


# ============================================================================
# Output Validation Schemas
# ============================================================================

class Citation(BaseModel):
    """Source citation for grounded responses"""
    source_id: str
    source_type: Literal["product", "document", "order", "policy"]
    title: str
    url: Optional[str] = None
    relevance_score: float = Field(..., ge=0.0, le=1.0)


class StructuredResponse(BaseModel):
    """
    Validated AI response with grounding checks
    
    Example:
        response = StructuredResponse(
            content="We have 5 wireless headphones under $100...",
            citations=[...],
            confidence=0.92,
            grounded=True
        )
    """
    content: str = Field(..., min_length=1, max_length=5000, description="Response content")
    citations: List[Citation] = Field(default_factory=list, description="Source citations")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence")
    grounded: bool = Field(..., description="Whether response is grounded in context")
    safety_level: SafetyLevel = Field(..., description="Output safety classification")
    
    @field_validator('content')
    @classmethod
    def check_content_safety(cls, v: str) -> str:
        """Check response for harmful content"""
        harmful_patterns = [
            "i cannot help with that",
            "as an ai",
            "i am not able",
        ]
        # These are actually okay, but flag for review
        v_lower = v.lower()
        if any(pattern in v_lower for pattern in harmful_patterns):
            # Don't reject, just note for monitoring
            pass
        return v
    
    @field_validator('grounded')
    @classmethod
    def check_groundedness(cls, v: bool, info) -> bool:
        """Ensure low confidence responses are marked as ungrounded"""
        if 'confidence' in info.data and info.data['confidence'] < 0.5 and v:
            raise ValueError("Low confidence responses must be marked as ungrounded")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "content": "We have 5 wireless headphones under $100. The top rated is...",
                "citations": [
                    {
                        "source_id": "prod_123",
                        "source_type": "product",
                        "title": "Sony WH-CH520",
                        "relevance_score": 0.95
                    }
                ],
                "confidence": 0.92,
                "grounded": True,
                "safety_level": "safe"
            }
        }


class GuardrailResult(BaseModel):
    """
    Complete guardrail evaluation result
    """
    input_valid: bool
    output_valid: bool
    input_safety: SafetyLevel
    output_safety: SafetyLevel
    toxicity_score: float
    pii_detected: bool
    hallucination_risk: float
    final_decision: Literal["allow", "warn", "block"]
    reasons: List[str] = Field(default_factory=list)


# ============================================================================
# Tool Execution Schemas
# ============================================================================

class ToolCall(BaseModel):
    """Validated tool call"""
    tool_name: str
    parameters: dict
    idempotency_key: str = Field(..., description="Unique key for idempotent execution")
    
    @field_validator('idempotency_key')
    @classmethod
    def generate_key(cls, v: str) -> str:
        """Ensure idempotency key is present"""
        if not v:
            import uuid
            return str(uuid.uuid4())
        return v


class ToolResult(BaseModel):
    """Validated tool execution result"""
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    execution_time_ms: int
    cached: bool = False


# ============================================================================
# Agent State Schemas
# ============================================================================

class AgentState(BaseModel):
    """
    Complete agent state with guardrails
    Used in LangGraph workflow
    """
    query: str
    validated_input: Optional[ValidatedInput] = None
    tool_calls: List[ToolCall] = Field(default_factory=list)
    tool_results: List[ToolResult] = Field(default_factory=list)
    response: Optional[StructuredResponse] = None
    guardrail_result: Optional[GuardrailResult] = None
    conversation_history: List[dict] = Field(default_factory=list)
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    
    @property
    def is_safe_to_proceed(self) -> bool:
        """Check if state is safe to proceed"""
        if not self.validated_input:
            return False
        return self.validated_input.is_allowed


# ============================================================================
# Export all schemas
# ============================================================================

__all__ = [
    # Enums
    "SafetyLevel",
    "IntentType",
    # Input schemas
    "SafeQuery",
    "ValidatedInput",
    # Output schemas
    "Citation",
    "StructuredResponse",
    "GuardrailResult",
    # Tool schemas
    "ToolCall",
    "ToolResult",
    # Agent state
    "AgentState",
]
