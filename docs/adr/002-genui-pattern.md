# ADR 002: Generative UI via LangGraph Native Pattern

**Date:** 2026-03
**Status:** Accepted

## Context

GenUI = agent decides which React component to render and with what props, based on the user's query.

## Decision

Use LangGraph's typedUi() + useStream() + LoadExternalComponent pattern. Components live in a registry (ui.tsx) registered in langgraph.json. LangGraph Platform bundles and serves them.

## Pattern

```
Server: ui.push({ name: 'product-grid', props: { products } })
Client: <LoadExternalComponent stream={thread} message={ui} />
```

## Alternatives Considered

- Vercel AI SDK streamUI: Paused. Rejected.
- Manual JSON tool results + client-side switch statement: Works but loses streaming. Components render all-at-once instead of progressively. More boilerplate.

## Consequences

- Components stream progressively as agent decides
- Type-safe props via ComponentMap registry
- Fallback UI while component bundle loads
- Components must be in apps/agent/src/ui/ registry
- LangGraph Platform must bundle and serve component assets
