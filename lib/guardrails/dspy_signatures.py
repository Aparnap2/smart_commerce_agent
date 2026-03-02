"""
DSPy Signatures for Guardrails

DSPy (Declarative Self-improving Language Programs) signatures for:
- Query safety analysis
- Response groundedness checking
- Intent classification
- Hallucination detection

These signatures can be compiled and optimized for better performance.

Usage:
    import dspy
    from lib.guardrails.dspy_signatures import SafeQuerySignature, GroundedResponseSignature
    
    # Configure LM (can use Azure OpenAI, Ollama, etc.)
    lm = dspy.LM('azure/gpt-4o-mini', api_key=..., api_base=...)
    dspy.configure(lm=lm)
    
    # Create module
    class SafetyModule(dspy.Module):
        def __init__(self):
            super().__init__()
            self.analyze = dspy.Predict(SafeQuerySignature)
        
        def forward(self, query: str):
            return self.analyze(query=query)
    
    # Use
    module = SafetyModule()
    result = module(query="Show me laptops")
    print(result.is_safe, result.intent)
"""

import dspy
from typing import List, Optional


# ============================================================================
# Input Safety Signatures
# ============================================================================

class SafeQuerySignature(dspy.Signature):
    """
    Analyze user query for safety and intent
    
    This signature analyzes incoming queries to detect:
    - Toxicity and harmful content
    - PII (Personally Identifiable Information)
    - Jailbreak attempts
    - User intent for routing
    """
    query: str = dspy.InputField(
        desc="User query to analyze",
        prefix="Query:",
        format=lambda x: x.strip()
    )
    is_safe: bool = dspy.OutputField(
        desc="Whether query is safe to process",
        prefix="Safe:",
    )
    intent: str = dspy.OutputField(
        desc="Detected user intent (search_products, add_to_cart, checkout, order_status, refund_request, support_ticket, greeting, general_query)",
        prefix="Intent:",
    )
    toxicity_score: float = dspy.OutputField(
        desc="Toxicity score from 0.0 (safe) to 1.0 (highly toxic)",
        prefix="Toxicity:",
    )
    pii_detected: bool = dspy.OutputField(
        desc="Whether personally identifiable information was detected",
        prefix="PII:",
    )
    requires_guardrails: bool = dspy.OutputField(
        desc="Whether additional guardrails should be applied",
        prefix="Guardrails:",
    )
    confidence: float = dspy.OutputField(
        desc="Confidence in this analysis (0.0 to 1.0)",
        prefix="Confidence:",
    )


class IntentClassificationSignature(dspy.Signature):
    """
    Classify query into specific e-commerce intent
    
    More detailed intent classification for routing to appropriate tools.
    """
    query: str = dspy.InputField(desc="User query")
    conversation_history: str = dspy.InputField(
        desc="Previous conversation context",
        prefix="History:",
        format=lambda x: x or "No previous conversation"
    )
    
    primary_intent: str = dspy.OutputField(
        desc="Primary intent category",
        prefix="Primary Intent:",
    )
    secondary_intent: Optional[str] = dspy.OutputField(
        desc="Secondary intent if applicable",
        prefix="Secondary Intent:",
    )
    required_tools: List[str] = dspy.OutputField(
        desc="List of tools needed to fulfill this intent",
        prefix="Tools:",
    )
    slot_values: dict = dspy.OutputField(
        desc="Extracted slot values (product_id, quantity, order_id, etc.)",
        prefix="Slots:",
    )


# ============================================================================
# Output Safety Signatures
# ============================================================================

class GroundedResponseSignature(dspy.Signature):
    """
    Generate safe, grounded response with citations
    
    Ensures responses are:
    - Grounded in provided context
    - Safe and appropriate
    - Properly cited
    - Helpful and relevant
    """
    query: str = dspy.InputField(desc="User query")
    context: str = dspy.InputField(
        desc="Retrieved context from RAG",
        prefix="Context:",
    )
    conversation_history: str = dspy.InputField(
        desc="Previous conversation",
        prefix="History:",
        format=lambda x: x or "No previous conversation"
    )
    
    response: str = dspy.OutputField(
        desc="Safe, grounded response to the query",
        prefix="Response:",
    )
    citations: List[str] = dspy.OutputField(
        desc="List of source IDs cited in the response",
        prefix="Citations:",
    )
    confidence: float = dspy.OutputField(
        desc="Confidence that response is grounded and accurate",
        prefix="Confidence:",
    )
    grounded: bool = dspy.OutputField(
        desc="Whether response is fully grounded in context",
        prefix="Grounded:",
    )


class HallucinationCheckSignature(dspy.Signature):
    """
    Detect potential hallucinations in AI response
    
    Compares response against context to identify unsupported claims.
    """
    query: str = dspy.InputField(desc="Original query")
    context: str = dspy.InputField(desc="Source context")
    response: str = dspy.InputField(desc="AI response to check")
    
    hallucinated_claims: List[str] = dspy.OutputField(
        desc="List of claims not supported by context",
        prefix="Hallucinated Claims:",
    )
    supported_claims: List[str] = dspy.OutputField(
        desc="List of claims supported by context",
        prefix="Supported Claims:",
    )
    hallucination_risk: float = dspy.OutputField(
        desc="Risk score 0.0 (no hallucination) to 1.0 (high risk)",
        prefix="Hallucination Risk:",
    )
    is_safe_to_use: bool = dspy.OutputField(
        desc="Whether response is safe to show to user",
        prefix="Safe to Use:",
    )


# ============================================================================
# Tool Safety Signatures
# ============================================================================

class ToolCallSafetySignature(dspy.Signature):
    """
    Validate tool call parameters for safety
    
    Ensures tool calls are:
    - Authorized for this user
    - Within safe parameter ranges
    - Not attempting injection attacks
    """
    tool_name: str = dspy.InputField(desc="Name of tool to call")
    parameters: dict = dspy.InputField(desc="Tool parameters")
    user_context: str = dspy.InputField(desc="User authorization context")
    
    is_authorized: bool = dspy.OutputField(
        desc="Whether user is authorized for this tool call",
        prefix="Authorized:",
    )
    is_safe: bool = dspy.OutputField(
        desc="Whether parameters are safe",
        prefix="Safe:",
    )
    risk_score: float = dspy.OutputField(
        desc="Risk score 0.0 (safe) to 1.0 (dangerous)",
        prefix="Risk:",
    )
    sanitized_parameters: dict = dspy.OutputField(
        desc="Sanitized parameters if any were unsafe",
        prefix="Sanitized Params:",
    )


# ============================================================================
# DSPy Modules
# ============================================================================

class SafetyModule(dspy.Module):
    """
    Complete safety analysis module
    
    Combines multiple signatures for comprehensive safety checking.
    """
    def __init__(self):
        super().__init__()
        self.analyze_safety = dspy.Predict(SafeQuerySignature)
        self.check_hallucination = dspy.Predict(HallucinationCheckSignature)
    
    def forward(self, query: str, context: Optional[str] = None, response: Optional[str] = None):
        # Analyze input safety
        safety_result = self.analyze_safety(query=query)
        
        result = {
            "input_safe": safety_result.is_safe,
            "intent": safety_result.intent,
            "toxicity": safety_result.toxicity_score,
            "pii": safety_result.pii_detected,
        }
        
        # Check output grounding if response provided
        if context and response:
            hallucination_result = self.check_hallucination(
                query=query,
                context=context,
                response=response
            )
            result["hallucination_risk"] = hallucination_result.hallucination_risk
            result["grounded"] = hallucination_result.is_safe_to_use
        
        return result


class IntentModule(dspy.Module):
    """
    Intent classification and slot filling module
    """
    def __init__(self):
        super().__init__()
        self.classify_intent = dspy.Predict(IntentClassificationSignature)
    
    def forward(self, query: str, history: Optional[str] = None):
        return self.classify_intent(
            query=query,
            conversation_history=history or ""
        )


class ResponseGenerationModule(dspy.Module):
    """
    Safe response generation with grounding
    """
    def __init__(self):
        super().__init__()
        self.generate = dspy.Predict(GroundedResponseSignature)
    
    def forward(self, query: str, context: str, history: Optional[str] = None):
        return self.generate(
            query=query,
            context=context,
            conversation_history=history or ""
        )


# ============================================================================
# Optimization Helpers
# ============================================================================

def compile_safety_module(
    trainset: List[dspy.Example],
    metric: callable,
    teacher_lm: Optional[dspy.LM] = None,
    student_lm: Optional[dspy.LM] = None
):
    """
    Compile and optimize safety module using DSPy
    
    Args:
        trainset: Training examples
        metric: Evaluation metric function
        teacher_lm: Teacher model for distillation (optional)
        student_lm: Student model to optimize
    
    Returns:
        Optimized SafetyModule
    """
    from dspy.teleprompt import BootstrapFewShot, LabeledFewShot
    
    module = SafetyModule()
    
    # Use BootstrapFewShot for optimization
    teleprompter = BootstrapFewShot(
        metric=metric,
        max_bootstrapped_demos=4,
        max_labeled_demos=8,
    )
    
    compiled_module = teleprompter.compile(
        module,
        trainset=trainset,
    )
    
    return compiled_module


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    # Example: Configure DSPy with your LM
    # lm = dspy.LM('azure/gpt-4o-mini', api_key='...', api_base='...')
    # dspy.configure(lm=lm)
    
    # Create module
    safety_module = SafetyModule()
    
    # Test input safety
    result = safety_module(query="Show me wireless headphones")
    print(f"Safe: {result['input_safe']}")
    print(f"Intent: {result['intent']}")
    
    # Test with response grounding
    result = safety_module(
        query="What's the return policy?",
        context="Returns accepted within 30 days",
        response="You can return items within 30 days of purchase"
    )
    print(f"Grounded: {result.get('grounded', 'N/A')}")
    print(f"Hallucination Risk: {result.get('hallucination_risk', 'N/A')}")


# Export public API
__all__ = [
    # Signatures
    "SafeQuerySignature",
    "IntentClassificationSignature",
    "GroundedResponseSignature",
    "HallucinationCheckSignature",
    "ToolCallSafetySignature",
    # Modules
    "SafetyModule",
    "IntentModule",
    "ResponseGenerationModule",
    # Optimization
    "compile_safety_module",
]
