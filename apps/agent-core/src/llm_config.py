"""
Unified LLM Configuration — single source of truth.
Provider-agnostic: just set LLM_PROVIDER and provider-specific env vars.

Supported providers: cohere, openrouter, ollama, local, openai, azure, mock

Usage:
    from src.llm_config import create_llm
    llm = create_llm()
"""

import json
import os
import re
from typing import Any

from loguru import logger


class MockLLM:
    """Mock LLM for testing without real LLM calls.

    Provides support-appropriate responses (cases, customers, KB articles)
    instead of the old procurement-themed responses.
    """

    model_name = "mock-llm"

    def __init__(self):
        self._mock_responses = {
            "cases": {
                "content": "I found the following cases for Acme Corp:",
                "__ui__": {
                    "name": "case-list",
                    "props": {
                        "cases": [
                            {
                                "caseNumber": "00001001",
                                "subject": "Login issue",
                                "status": "Open",
                                "priority": "High",
                            },
                            {
                                "caseNumber": "00001002",
                                "subject": "Billing discrepancy",
                                "status": "In Progress",
                                "priority": "Medium",
                            },
                            {
                                "caseNumber": "00001003",
                                "subject": "Feature request",
                                "status": "Closed",
                                "priority": "Low",
                            },
                        ],
                        "loading": False,
                    },
                },
            },
            "case_detail": {
                "content": "Here are the details for case 00001001:",
                "__ui__": {
                    "name": "case-detail",
                    "props": {
                        "case": {
                            "caseNumber": "00001001",
                            "subject": "Login issue — unable to access dashboard",
                            "status": "Open",
                            "priority": "High",
                            "description": (
                                "Customer reports being unable to log in after "
                                "recent password reset."
                            ),
                            "createdDate": "2026-05-15T08:30:00Z",
                            "contactId": "003ABC000001",
                            "accountName": "Acme Corp",
                        },
                        "loading": False,
                    },
                },
            },
            "customer_context": {
                "content": "Customer context for Contact #123:",
                "__ui__": {
                    "name": "customer-context",
                    "props": {
                        "customer": {
                            "contactId": "003ABC000001",
                            "name": "Jane Smith",
                            "accountName": "Acme Corp",
                            "email": "jane.smith@acme.com",
                            "phone": "+1-555-0100",
                            "openCases": 2,
                            "totalCases": 15,
                            "lastInteraction": "2026-05-14T16:45:00Z",
                        },
                        "loading": False,
                    },
                },
            },
            "kb_article": {
                "content": "Here is a knowledge base article that matches your query:",
                "__ui__": {
                    "name": "kb-article",
                    "props": {
                        "article": {
                            "id": "KA-001",
                            "title": "Troubleshooting Login Issues",
                            "category": "Technical Support",
                            "lastModified": "2026-05-10T12:00:00Z",
                            "viewCount": 1542,
                        },
                        "loading": False,
                    },
                },
            },
        }

    async def ainvoke(self, messages, config=None):
        """Return mock response based on last user message."""
        from langchain_core.messages import AIMessage

        last_msg = messages[-1] if messages else None
        user_message = ""
        if hasattr(last_msg, "content"):
            user_message = last_msg.content.lower()

        response_data = None
        if any(k in user_message for k in ["case", "ticket", "issue", "bug"]):
            response_data = self._mock_responses["cases"]
        elif any(k in user_message for k in ["customer", "contact", "account", "client"]):
            response_data = self._mock_responses["customer_context"]
        elif any(k in user_message for k in ["kb", "knowledge", "article", "documentation", "guide"]):
            response_data = self._mock_responses["kb_article"]
        elif any(k in user_message for k in ["detail", "status", "info"]):
            response_data = self._mock_responses["case_detail"]
        else:
            response_data = {
                "content": (
                    "This is a mock response. "
                    "Try asking about 'cases', 'customer', or 'kb article'."
                ),
                "__ui__": None,
            }

        content = json.dumps(response_data)
        return AIMessage(content=content)

    def bind_tools(self, tools):
        return self


class ThinkTagStrippingLLM:
    """Wrapper around ChatOpenAI that strips `<think>...</think>` blocks.

    Some reasoning models (Qwen, DeepSeek) emit chain-of-thought inside
    these tags.  The thinking is internal — it must never reach the
    application layer or the end-user.
    """

    def __init__(self, llm: Any):
        self._llm = llm
        self.model_name = getattr(llm, "model_name", "unknown")

    async def ainvoke(self, messages, config=None, **kwargs):
        resp = await self._llm.ainvoke(messages, config=config, **kwargs)
        if hasattr(resp, "content") and resp.content:
            cleaned = re.sub(
                r"<think>.*?</think>", "", resp.content, flags=re.DOTALL
            ).strip()
            if cleaned != resp.content:
                logger.debug("Stripped <think> tags from Groq response")
                resp.content = cleaned
        return resp

    def bind_tools(self, tools):
        self._llm = self._llm.bind_tools(tools)
        return self


class FallbackLLM:
    """Wrapper LLM that tries a primary provider and falls back to a
    secondary provider on failure (rate limits, server errors, etc.).

    Useful for pairing a high-quality paid model (primary) with a free
    or cheaper model (secondary) as reliability insurance.
    """

    def __init__(self, primary: Any, secondary: Any):
        self._primary = primary
        self._secondary = secondary
        self._tools: list | None = None
        self.model_name = (
            f"{getattr(primary, 'model_name', 'primary')}"
            f"|{getattr(secondary, 'model_name', 'fallback')}"
        )

    async def ainvoke(self, messages, config=None, **kwargs):
        """Try primary first; on any exception, log and retry secondary."""
        try:
            return await self._primary.ainvoke(messages, config=config, **kwargs)
        except Exception as exc:
            logger.warning(
                "Primary LLM failed (%s: %s). Falling back to secondary.",
                type(exc).__name__,
                exc,
            )
            return await self._secondary.ainvoke(
                messages, config=config, **kwargs
            )

    def bind_tools(self, tools):
        """Bind tools to both providers and return self."""
        self._tools = tools
        self._primary = self._primary.bind_tools(tools)
        self._secondary = self._secondary.bind_tools(tools)
        return self


# ── Provider configuration ─────────────────────────────────────────────────


def create_llm(temperature: float = 0) -> "ChatOpenAI | MockLLM | FallbackLLM":
    """Create an LLM instance based on the LLM_PROVIDER env var.

    Returns:
        ChatOpenAI (for real providers) or MockLLM (for testing).
    """
    provider = os.environ.get("LLM_PROVIDER", "cohere").lower().strip()
    fallback_enabled = os.environ.get("GROQ_FALLBACK", "").lower() in (
        "true",
        "1",
        "yes",
    )
    logger.info(f"Initializing LLM with provider: {provider}")
    logger.info(f"Groq fallback: {'enabled' if fallback_enabled else 'disabled'}")

    if provider == "mock":
        logger.info("✅ Mock LLM initialized (LLM_PROVIDER=mock)")
        return MockLLM()

    from langchain_openai import ChatOpenAI

    if provider == "cohere":
        api_key = os.environ.get("COHERE_API_KEY")
        model = os.environ.get("COHERE_MODEL", "command-a-plus-05-2026")
        base_url = os.environ.get(
            "COHERE_BASE_URL", "https://api.cohere.ai/compatibility/v1"
        )
        primary = ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key=api_key,
        )
        logger.info(f"✅ Cohere LLM created (model={model})")

        # Build Groq fallback if enabled
        if fallback_enabled:
            groq_key = os.environ.get("GROQ_API_KEY")
            groq_model = os.environ.get(
                "GROQ_MODEL", "llama-3.3-70b-versatile"
            )
            groq_base_url = os.environ.get(
                "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
            )
            if groq_key:
                secondary = ChatOpenAI(
                    model=groq_model,
                    temperature=temperature,
                    base_url=groq_base_url,
                    api_key=groq_key,
                )
                logger.info(
                    f"✅ Groq fallback configured (model={groq_model})"
                )
                return FallbackLLM(primary, secondary)

        return primary

    elif provider == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        model = os.environ.get("GROQ_MODEL", "qwen/qwen3-32b")
        base_url = os.environ.get(
            "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
        )
        inner = ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key=api_key,
        )
        # Wrap to strip <think> tags — Qwen/DeepSeek models emit them
        llm = ThinkTagStrippingLLM(inner)
        logger.info(f"✅ Groq LLM created (model={model}, think-tag-stripping=on)")
        return llm

    elif provider == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY")
        model = os.environ.get(
            "OPENROUTER_MODEL", "deepseek/deepseek-v4-flash:free"
        )
        base_url = os.environ.get(
            "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
        )
        llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key=api_key,
        )
        logger.info(
            f"✅ LLM initialized (provider=openrouter, model={model})"
        )
        return llm

    elif provider == "ollama":
        api_key = os.environ.get("OLLAMA_API_KEY")
        model = os.environ.get("OLLAMA_MODEL", "gpt-oss:120b")
        base_url = os.environ.get("OLLAMA_BASE_URL", "https://ollama.com/v1")
        llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key=api_key,
        )
        logger.info(f"✅ LLM initialized (provider=ollama, model={model})")
        return llm

    elif provider == "local":
        model = os.environ.get("OLLAMA_MODEL", "qwen3:0.6b")
        base_url = os.environ.get(
            "OLLAMA_BASE_URL", "http://localhost:11434/v1"
        )
        llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key="ollama",
        )
        logger.info(f"✅ LLM initialized (provider=local, model={model})")
        return llm

    elif provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        model = os.environ.get("OPENAI_MODEL", "gpt-4o")
        base_url = os.environ.get("OPENAI_BASE_URL")
        kwargs: dict[str, Any] = {
            "model": model,
            "temperature": temperature,
            "api_key": api_key,
        }
        if base_url:
            kwargs["base_url"] = base_url
        llm = ChatOpenAI(**kwargs)
        logger.info(f"✅ LLM initialized (provider=openai, model={model})")
        return llm

    elif provider == "azure":
        api_key = os.environ.get("AZURE_OPENAI_API_KEY")
        model = os.environ.get("AZURE_OPENAI_DEPLOYMENT")
        base_url = os.environ.get("AZURE_OPENAI_BASE_URL")
        api_version = os.environ.get(
            "AZURE_OPENAI_API_VERSION", "2024-10-21"
        )
        if not model:
            raise ValueError(
                "AZURE_OPENAI_DEPLOYMENT must be set for Azure provider"
            )
        if not base_url:
            raise ValueError(
                "AZURE_OPENAI_BASE_URL must be set for Azure provider"
            )
        llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=base_url,
            api_key=api_key,
            default_query={"api-version": api_version},
        )
        logger.info(f"✅ LLM initialized (provider=azure, model={model})")
        return llm

    else:
        raise ValueError(
            f"Unknown LLM_PROVIDER: {provider}. "
            "Supported: cohere, openrouter, ollama, local, openai, azure, mock"
        )


def get_openai_client() -> Any:
    """Create an OpenAI-compatible client based on LLM_PROVIDER.

    Useful for non-langchain OpenAI calls (e.g., embeddings, direct API).
    Returns None for the mock provider.
    """
    provider = os.environ.get("LLM_PROVIDER", "cohere").lower().strip()

    if provider == "mock":
        return None

    from openai import AsyncOpenAI

    if provider == "cohere":
        return AsyncOpenAI(
            api_key=os.environ.get("COHERE_API_KEY"),
            base_url=os.environ.get(
                "COHERE_BASE_URL", "https://api.cohere.com/v2/chat"
            ),
        )
    elif provider == "groq":
        return AsyncOpenAI(
            api_key=os.environ.get("GROQ_API_KEY"),
            base_url=os.environ.get(
                "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
            ),
        )
    elif provider == "openrouter":
        return AsyncOpenAI(
            api_key=os.environ.get("OPENROUTER_API_KEY"),
            base_url=os.environ.get(
                "OLLAMA_BASE_URL", "https://openrouter.ai/api/v1"
            ),
        )
    elif provider == "ollama":
        return AsyncOpenAI(
            api_key=os.environ.get("OLLAMA_API_KEY"),
            base_url=os.environ.get("OLLAMA_BASE_URL", "https://ollama.com/v1"),
        )
    elif provider == "local":
        return AsyncOpenAI(
            api_key="ollama",
            base_url=os.environ.get(
                "OLLAMA_BASE_URL", "http://localhost:11434/v1"
            ),
        )
    elif provider == "openai":
        kwargs: dict[str, Any] = {
            "api_key": os.environ.get("OPENAI_API_KEY"),
        }
        base_url = os.environ.get("OPENAI_BASE_URL")
        if base_url:
            kwargs["base_url"] = base_url
        return AsyncOpenAI(**kwargs)
    elif provider == "azure":
        base_url = os.environ.get("AZURE_OPENAI_BASE_URL")
        api_version = os.environ.get(
            "AZURE_OPENAI_API_VERSION", "2024-10-21"
        )
        return AsyncOpenAI(
            api_key=os.environ.get("AZURE_OPENAI_API_KEY"),
            base_url=base_url,
            default_query={"api-version": api_version},
        )
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
