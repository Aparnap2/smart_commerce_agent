# Environment Variables

Copy apps/web/.env.example to apps/web/.env.local and fill in all required values.

## Required

| Variable            | Description                      | Example                                                      |
|--------------------|----------------------------------|--------------------------------------------------------------|
| DATABASE_URL       | PostgreSQL connection string     | postgresql://postgres:pw@localhost:5432/smart_commerce     |
| NEXTAUTH_SECRET    | JWT signing secret (32+ chars)  | openssl rand -base64 32                                      |
| NEXTAUTH_URL       | App base URL                    | http://localhost:3000                                       |
| LLM_API_KEY       | LLM provider API key             | AIza... / sk-...                                            |
| LLM_BASE_URL      | OpenAI-compatible base URL       | https://generativelanguage.googleapis.com/v1beta/openai/    |
| LLM_MODEL         | Model name                      | gemini-2.0-flash                                           |
| REDIS_URL         | Redis connection URL             | redis://localhost:6379                                      |

## Optional

| Variable                    | Description                    | Default                    |
|-----------------------------|--------------------------------|----------------------------|
| EMBEDDING_API_KEY          | Embedding provider key         | Falls back to LLM_API_KEY |
| EMBEDDING_BASE_URL         | Embedding base URL            | Falls back to LLM_BASE_URL |
| EMBEDDING_MODEL            | Embedding model name          | text-embedding-004        |
| LANGGRAPH_URL              | Server-side LangGraph URL     | http://localhost:2024    |
| NEXT_PUBLIC_LANGGRAPH_URL  | Client-side LangGraph URL    | http://localhost:2024    |
| LANGFUSE_PUBLIC_KEY       | Langfuse public key          | disabled                  |
| LANGFUSE_SECRET_KEY       | Langfuse secret key          | disabled                  |
| LANGFUSE_BASE_URL         | Langfuse server URL          | http://localhost:3003    |

## Provider Examples

### Google AI Studio (recommended — free tier)
```bash
LLM_API_KEY=AIza...
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-2.0-flash
EMBEDDING_MODEL=gemini-embedding-001
```

### OpenAI
```bash
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
```

### Groq (no embeddings — keep OpenAI for embeddings)
```bash
LLM_API_KEY=gsk_...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
EMBEDDING_API_KEY=<openai-key>
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

### Ollama (fully local)
```bash
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
```
