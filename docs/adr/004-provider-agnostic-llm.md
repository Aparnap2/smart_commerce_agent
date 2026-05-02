# ADR 004: Provider-Agnostic LLM via OpenAI Compatibility

**Date:** 2026-03
**Status:** Accepted

## Context

Wanted to avoid vendor lock-in to a single LLM provider. Different environments (dev/prod/test) may use different models.

## Decision

Single ChatOpenAI instance in apps/agent/src/llm.ts configured via LLM_BASE_URL + LLM_API_KEY + LLM_MODEL env vars. All OpenAI-compatible providers work without code changes.

## Supported Providers (tested)

- Google AI Studio (Gemini 2.0 Flash) — default dev
- OpenAI (GPT-4o) — production recommended
- Groq (Llama 3.3 70B) — fast, cheap alternative
- Ollama (Llama 3.2) — fully local, no API key needed

## Consequences

- Swap providers by changing 2 env vars
- Same codebase runs against any OpenAI-compatible API
- Embedding can use a different provider than chat
- Provider-specific features (Gemini tools, O1 reasoning) not accessible through the compat layer
- Tool calling behaviour varies slightly between providers (tested and working with all listed above)
