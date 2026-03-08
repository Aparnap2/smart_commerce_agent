"""
LLM Provider - Supports both real LLM and mock for testing
"""

import os
from typing import Any, Optional

# Use mock LLM for E2E testing if enabled
if os.environ.get("MOCK_LLM") == "true":
    from llm.mock_provider import MockChatModel
    
    def get_llm(temperature: float = 0.1) -> MockChatModel:
        """Get mock LLM instance for testing"""
        return MockChatModel(temperature=temperature)
    
    def get_openai_client() -> Any:
        """Mock OpenAI client for testing"""
        return None
else:
    from langchain_openai import ChatOpenAI
    from openai import AsyncOpenAI
    
    def get_llm(temperature: float = 0.2) -> ChatOpenAI:
        base_url = os.environ.get("OPENAI_BASE_URL")
        if not base_url:
            raise ValueError("OPENAI_BASE_URL is required")
        return ChatOpenAI(
            model=os.environ.get("OPENAI_MODEL", "gpt-oss-120b"),
            temperature=temperature,
            max_retries=2,
            openai_api_key=os.environ.get("OPENAI_API_KEY", "placeholder"),
            openai_api_base=base_url,
            default_query=(
                {"api-version": os.environ["OPENAI_API_VERSION"]}
                if os.environ.get("OPENAI_API_VERSION")
                else {}
            ),
        )
    
    def get_openai_client() -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key=os.environ.get("OPENAI_API_KEY", "placeholder"),
            base_url=os.environ.get("OPENAI_BASE_URL"),
            default_query=(
                {"api-version": os.environ["OPENAI_API_VERSION"]}
                if os.environ.get("OPENAI_API_VERSION")
                else {}
            ),
        )
