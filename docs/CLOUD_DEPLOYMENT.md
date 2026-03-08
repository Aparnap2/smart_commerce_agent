# Free Cloud Deployment Guide

Deploy the Smart Commerce Agent to **$0** using serverless infrastructure.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Smart Commerce Agent                     │
│                    (LangGraph + Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│                     State Store:                             │
│              Neon Postgres (Free Tier)                       │
│         Checkpoint Type: postgres                            │
├─────────────────────────────────────────────────────────────┤
│  Vercel (Frontend/API)     │     Render (Worker)            │
│  - Next.js App              │     - LangGraph Agent          │
│  - Chat UI                  │     - Background Tasks         │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Set Up Free Cloud Services

### 1.1 Neon (PostgreSQL) - Free Tier

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project:
   ```text
   Project: smart-commerce-agent
   Database: smart_commerce
   ```
3. Copy the connection string:
   ```bash
   # Format:
   postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neon_db?sslmode=require
   ```
4. Enable pgvector extension in Neon console:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 1.2 Langfuse (Observability) - Free Tier

1. Sign up at [cloud.langfuse.com](https://cloud.langfuse.com)
2. Create a new project
3. Copy your API keys from Settings > API Keys

### 1.3 Qdrant Cloud (Vector Search) - Free Tier (Optional)

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a free cluster
3. Copy the cluster URL and API key

---

## Step 2: Environment Configuration

### Vercel Environment Variables

Go to Vercel Dashboard > Settings > Environment Variables:

| Variable                | Value                                            | Type   |
|-------------------------|--------------------------------------------------|--------|
| `DATABASE_URL`          | `postgresql://...@ep-xxx.neon.tech/...`         | Secret |
| `CHECKPOINT_TYPE`       | `postgres`                                       | Plain  |
| `LANGFUSE_PUBLIC_KEY`   | `pl_...`                                         | Secret |
| `LANGFUSE_SECRET_KEY`   | `sk_...`                                         | Secret |
| `LANGFUSE_BASE_URL`     | `https://cloud.langfuse.com`                     | Plain  |
| `OLLAMA_BASE_URL`       | `https://your-ollama-instance.com`   | Plain  |
| `OLLAMA_MODEL`          | `qwen2.5-coder:3b`                   | Plain  |

### Render Environment Variables

Go to Render Dashboard > Your Service > Environment:

| Variable                | Value                 |
|-------------------------|-----------------------|
| `DATABASE_URL`          | (Same as Vercel)      |
| `CHECKPOINT_TYPE`       | `postgres`            |
| `LANGFUSE_PUBLIC_KEY`   | (Same as Vercel)      |
| `LANGFUSE_SECRET_KEY`   | (Same as Vercel)      |
| `LANGFUSE_BASE_URL`     | `https://cloud.langfuse.com` |
| `OLLAMA_BASE_URL`       | `https://your-ollama-instance.com` |
| `OLLAMA_MODEL`          | `qwen2.5-coder:3b`    |

---

## Step 3: Deploy to Vercel

### 3.1 Connect Repository

```bash
# Push code to GitHub
git add .
git commit -m "feat: prepare for cloud deployment"
git push origin main
```

### 3.2 Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Framework Preset: Next.js (Auto-detected)

### 3.5 Deploy

Click "Deploy" - Vercel will automatically:
- Install dependencies (`pnpm install`)
- Build the Next.js app (`pnpm build`)
- Start the server (`pnpm start`)

---

## Step 4: Deploy to Render (Optional - For Background Workers)

### 4.1 Create Web Service

1. Go to [render.com](https://render.com)
2. New > Web Service
3. Connect your GitHub repository

### 4.2 Configure Build

| Setting        | Value                            |
|----------------|----------------------------------|
| Build Command  | `pnpm install && pnpm build`     |
| Start Command  | `pnpm start`                     |
| Plan           | Free                             |

### 4.3 Environment Variables

Add all variables from Step 2.

---

## Step 5: Verify Deployment

### 5.1 Check Langfuse Traces

1. Open Langfuse Dashboard
2. You should see traces from your deployed agent
3. Check for any errors

### 5.2 Test Chat Endpoint

```bash
curl -X POST https://your-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### 5.3 Verify State Persistence

1. Start a conversation
2. Refresh the page
3. Conversation should continue (LangGraph checkpoints working)

---

## Troubleshooting

### Connection Issues

```bash
# Test Neon connection
psql "postgresql://user:pass@ep-xxx.neon.tech/neon_db?sslmode=require" -c "SELECT 1"
```

### pgvector Not Enabled

In Neon SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### LangGraph Checkpointer Errors

Ensure `CHECKPOINT_TYPE=postgres` is set and `DATABASE_URL` is correct.

---

## Cost Summary

| Service         | Free Tier                                  | Cost |
|-----------------|--------------------------------------------|------|
| Vercel          | 100GB bandwidth, serverless functions     | $0   |
| Render          | 750 hours/month                            | $0   |
| Neon            | 100GB storage, 100 connections            | $0   |
| Langfuse        | 50,000 traces/month                        | $0   |
| Qdrant Cloud    | 1 cluster, 1GB storage                     | $0   |

### Total Monthly Cost: $0

---

## Local Development (Docker)

Still need to run locally? Use the startup script:

```bash
# Start all services
./scripts/start-infrastructure.sh start

# Run locally
pnpm dev
```

The app works identically locally and on cloud!
