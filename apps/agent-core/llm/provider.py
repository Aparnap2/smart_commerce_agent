"""
LLM Provider - Supports mock, OpenAI/Azure, and Ollama (OpenAI-compatible)
"""

import os
from typing import Any

USE_OLLAMA = os.environ.get("USE_OLLAMA") == "true" and os.environ.get("OLLAMA_API_KEY")
USE_LOCAL_OLLAMA = os.environ.get("USE_LOCAL_OLLAMA") == "true"

# Priority: LOCAL_OLLAMA > USE_OLLAMA (cloud) > OpenAI/Azure > Mock
if USE_LOCAL_OLLAMA:
    from langchain_openai import ChatOpenAI

    def get_llm(temperature: float = 0.2) -> ChatOpenAI:
        return ChatOpenAI(
            model=os.environ.get("OLLAMA_MODEL", "gpt-oss:120b"),
            temperature=temperature,
            max_retries=2,
            openai_api_key="ollama",
            openai_api_base="http://localhost:11434/v1",
        )

    def get_openai_client() -> Any:
        from openai import AsyncOpenAI
        return AsyncOpenAI(
            api_key="ollama",
            base_url="http://localhost:11434/v1",
        )

elif USE_OLLAMA:
    from langchain_openai import ChatOpenAI

    def get_llm(temperature: float = 0.2) -> ChatOpenAI:
        return ChatOpenAI(
            model=os.environ.get("OLLAMA_MODEL", "gpt-oss:120b"),
            temperature=temperature,
            max_retries=2,
            openai_api_key=os.environ.get("OLLAMA_API_KEY"),
            openai_api_base="https://ollama.com/v1",
        )

    def get_openai_client() -> Any:
        from openai import AsyncOpenAI
        return AsyncOpenAI(
            api_key=os.environ.get("OLLAMA_API_KEY"),
            base_url="https://ollama.com/v1",
        )

elif os.environ.get("OPENAI_API_KEY") or os.environ.get("AZURE_OPENAI_API_KEY"):
    from langchain_openai import ChatOpenAI
    from openai import AsyncOpenAI

    def get_llm(temperature: float = 0.2) -> ChatOpenAI:
        base_url = os.environ.get("OPENAI_BASE_URL")
        if not base_url:
            raise ValueError("OPENAI_BASE_URL is required")
        return ChatOpenAI(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o"),
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

else:
    from llm.mock_provider import MockChatModel

    def get_llm(temperature: float = 0.1) -> MockChatModel:
        return MockChatModel(temperature=temperature)

    def get_openai_client() -> Any:
        return None