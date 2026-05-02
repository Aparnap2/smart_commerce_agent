# ADR 003: Hybrid Semantic + Keyword Search

**Date:** 2026-03
**Status:** Accepted

## Context

"Headphones for gym" does not keyword-match "sports earbuds". Pure keyword search misses conceptual matches. Pure vector search misses exact brand/model queries.

## Decision

hybridSearch() = semanticSearch() merged with keywordSearch(). Semantic results rank first. Keyword fills gaps. Falls back to keyword-only if embedding API fails.

## Embedding config

- Model: text-embedding-004 (Google) or text-embedding-3-small (OpenAI)
- Dimensions: 768 (Google) or 1536 (OpenAI)
- Index: ivfflat cosine, lists=10 (suitable for < 10k products)
- Stored in Product.embedding (pgvector column)

## Consequences

- "Gift for gamer under ₹5000" returns gaming accessories
- Exact model search still works via keyword fallback
- Graceful degradation if embedding API is down
- One-time embed-products script required after seed
- Embedding dim must match schema (migration needed to change)
