# 🚀 TechTrend Deployment Guide

**Last Updated**: 2026-03-24  
**Status**: ✅ **Ready for Deployment**  
**Current State**: 90% complete (305 tests passing, locally production-ready)

---

## 📋 DEPLOYMENT OVERVIEW

This guide covers deploying TechTrend to **Azure Container Apps** with:
- PostgreSQL Flexible Server (with pgvector)
- Redis (internal Container App)
- Azure Container Registry
- Web + Agent Container Apps
- Azure OpenAI integration

**Estimated Time**: 2-3 hours  
**Cost**: Free tier (12 months for most services)

---

## 🎯 PREREQUISITES

### Required Tools
```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Bicep (Azure deployment templates)
az bicep install

# Docker
sudo apt install docker.io  # or use Docker Desktop

# Node.js 20+
node --version  # must be v20.x or higher
```

### Azure Subscription
- Active Azure subscription with **Owner** or **Contributor** role
- Azure OpenAI access (already configured per assessment ✅)
- Quota for:
  - Container Apps (2 apps)
  - PostgreSQL Flexible Server (1 server, B1ms tier)
  - Container Registry (1 registry, Standard tier)

### Existing Resources (Per Assessment)
- ✅ Azure OpenAI endpoint working
- ✅ Azure OpenAI API key available
- ✅ Deployment name: `gpt-4o` or `gpt-oss-120b`

---

## 📁 PROJECT STRUCTURE

```
/home/aparna/Desktop/vercel-ai-sdk/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── Dockerfile    # ✅ EXISTS
│   │   └── ...
│   └── agent/            # LangGraph agent
│       ├── Dockerfile    # ✅ EXISTS
│       └── ...
├── infra/                # ❌ TO BE CREATED
│   ├── main.bicep
│   ├── main.bicepparam
│   └── deploy.sh
└── ...
```

---

## 🏗️ DEPLOYMENT STEPS

### Step 1: Collect Existing Values

```bash
# Create deployment vars file (NOT committed to git)
cat > /tmp/techtrend-deploy.sh << 'EOF'
export RG="techtrend-rg"
export LOCATION="centralindia"          # Mumbai region
export PREFIX="techtrend"
export ACR_NAME="techtrendarcUNIQUE"    # CHANGE: must be globally unique
export AZURE_OPENAI_ENDPOINT="https://YOUR-RESOURCE.openai.azure.com/"
export AZURE_OPENAI_API_KEY="YOUR-KEY"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o"
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small"
export AZURE_OPENAI_API_VERSION="2024-02-01"
export PG_ADMIN_USER="techtrend"
export PG_ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '=+/')"
export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
EOF

# Source it
source /tmp/techtrend-deploy.sh

# Save secrets securely
echo "PG_PASSWORD=$PG_ADMIN_PASSWORD" > /tmp/secrets.txt
echo "NextAuth_secret=$NEXTAUTH_SECRET" >> /tmp/secrets.txt
chmod 600 /tmp/secrets.txt
```

---

### Step 2: Verify Azure Authentication

```bash
# Check current subscription
az account show --query "{sub:id, name:name}" -o table

# Set subscription if needed
az account set --subscription "<your-subscription-id>"

# Verify resource group (create if needed)
az group list -o table
# OR create new:
az group create --name $RG --location $LOCATION
```

---

### Step 3: Create Container Registry

```bash
az acr create \
  --resource-group $RG \
  --name $ACR_NAME \
  --sku Standard \
  --location $LOCATION \
  --admin-enabled true

# Get credentials
export ACR_SERVER="${ACR_NAME}.azurecr.io"
export ACR_USER=$(az acr credential show --name $ACR_NAME --query username -o tsv)
export ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# Login
az acr login --name $ACR_NAME
```

---

### Step 4: Build + Push Docker Images

```bash
# Build web app
cd apps/web
docker build \
  --build-arg NEXT_PUBLIC_LANGGRAPH_URL="https://${PREFIX}-agent.azurecontainerapps.io" \
  -t ${ACR_SERVER}/techtrend-web:latest \
  -t ${ACR_SERVER}/techtrend-web:$(git rev-parse --short HEAD) \
  .

# Build agent
cd ../agent
docker build \
  -t ${ACR_SERVER}/techtrend-agent:latest \
  -t ${ACR_SERVER}/techtrend-agent:$(git rev-parse --short HEAD) \
  .

# Push both images
docker push ${ACR_SERVER}/techtrend-web:latest
docker push ${ACR_SERVER}/techtrend-agent:latest

# Verify
az acr repository list --name $ACR_NAME -o table
# Should show: techtrend-agent, techtrend-web
```

---

### Step 5: Create Bicep Deployment Template

**File**: `infra/main.bicep` (600 lines)

```bicep
// TechTrend — Azure Container Apps deployment
targetScope = 'resourceGroup'

// Parameters
@description('Location for all resources')
param location string = resourceGroup().location

@description('Short prefix for all resource names')
param prefix string = 'techtrend'

@secure()
@description('PostgreSQL admin password')
param pgAdminPassword string

@secure()
@description('NextAuth signing secret')
param nextAuthSecret string

@secure()
@description('Azure OpenAI API Key')
param azureOpenAiKey string

@description('Azure OpenAI endpoint URL')
param azureOpenAiEndpoint string

@description('Azure OpenAI chat deployment name')
param azureOpenAiDeployment string = 'gpt-4o'

@description('Container Registry server')
param acrServer string

@description('Container Registry username')
param acrUsername string

@secure()
@description('Container Registry password')
param acrPassword string

// Variables
var pgServerName = '${prefix}-pg'
var pgDbName = prefix
var envName = '${prefix}-env'
var agentAppName = '${prefix}-agent'
var webAppName = '${prefix}-web'
var redisAppName = '${prefix}-redis'
var logWorkspace = '${prefix}-logs'

// Log Analytics (required by Container Apps)
resource logws 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logWorkspace
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// Container Apps Environment
resource env 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logws.properties.customerId
        sharedKey: logws.listKeys().primarySharedKey
      }
    }
  }
}

// PostgreSQL Flexible Server (free 12 months)
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: pgServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: 'techtrend'
    administratorLoginPassword: pgAdminPassword
    version: '16'
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

// Enable pgvector extension
resource pgvectorConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: pgServer
  name: 'azure.extensions'
  properties: {
    value: 'vector'
    source: 'user-override'
  }
}

// Database
resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pgServer
  name: pgDbName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Database connection string
var databaseUrl = 'postgresql://techtrend:${pgAdminPassword}@${pgServer.properties.fullyQualifiedDomainName}:5432/${pgDbName}?sslmode=require'

// Redis Container App (internal)
resource redisApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: redisAppName
  location: location
  properties: {
    environmentId: env.id
    configuration: {
      ingress: {
        external: false
        targetPort: 6379
        transport: 'tcp'
      }
    }
    template: {
      containers: [{
        name: 'redis'
        image: 'redis:7-alpine'
        resources: {
          cpu: json('0.25')
          memory: '0.5Gi'
        }
        args: ['redis-server', '--appendonly', 'yes']
      }]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

var redisFqdn = '${redisAppName}.internal.${env.properties.defaultDomain}'
var redisUrl = 'redis://${redisFqdn}:6379'

// Agent Container App
resource agentApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: agentAppName
  location: location
  properties: {
    environmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 2024
        transport: 'http'
      }
      registries: [{
        server: acrServer
        username: acrUsername
        passwordSecretRef: 'acr-password'
      }]
      secrets: [
        { name: 'acr-password', value: acrPassword }
        { name: 'azure-openai-key', value: azureOpenAiKey }
        { name: 'database-url', value: databaseUrl }
      ]
    }
    template: {
      containers: [{
        name: 'agent'
        image: '${acrServer}/techtrend-agent:latest'
        resources: {
          cpu: json('0.5')
          memory: '1.0Gi'
        }
        env: [
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'REDIS_URL', value: redisUrl }
          { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-key' }
          { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
          { name: 'AZURE_OPENAI_DEPLOYMENT_NAME', value: azureOpenAiDeployment }
          { name: 'LANGFUSE_PUBLIC_KEY', value: 'disabled' }
          { name: 'NODE_ENV', value: 'production' }
        ]
        probes: [{
          type: 'liveness'
          httpGet: { path: '/ok', port: 2024 }
          initialDelaySeconds: 20
          periodSeconds: 15
        }]
      }]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
  dependsOn: [redisApp, pgDb]
}

// Web Container App
resource webApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: webAppName
  location: location
  properties: {
    environmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
      }
      registries: [{
        server: acrServer
        username: acrUsername
        passwordSecretRef: 'acr-password'
      }]
      secrets: [
        { name: 'acr-password', value: acrPassword }
        { name: 'nextauth-secret', value: nextAuthSecret }
        { name: 'azure-openai-key', value: azureOpenAiKey }
        { name: 'database-url', value: databaseUrl }
      ]
    }
    template: {
      containers: [{
        name: 'web'
        image: '${acrServer}/techtrend-web:latest'
        resources: {
          cpu: json('0.5')
          memory: '1.0Gi'
        }
        env: [
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'NEXTAUTH_SECRET', secretRef: 'nextauth-secret' }
          { name: 'NEXTAUTH_URL', value: 'https://${webAppName}.${env.properties.defaultDomain}' }
          { name: 'LANGGRAPH_URL', value: 'https://${agentApp.properties.configuration.ingress.fqdn}' }
          { name: 'NEXT_PUBLIC_LANGGRAPH_URL', value: 'https://${agentApp.properties.configuration.ingress.fqdn}' }
          { name: 'UPSTASH_REDIS_REST_URL', value: redisUrl }
          { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-key' }
          { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
          { name: 'AZURE_OPENAI_DEPLOYMENT_NAME', value: azureOpenAiDeployment }
          { name: 'NODE_ENV', value: 'production' }
        ]
        probes: [{
          type: 'liveness'
          httpGet: { path: '/api/health', port: 3000 }
          initialDelaySeconds: 30
          periodSeconds: 20
        }]
      }]
      scale: {
        minReplicas: 1
        maxReplicas: 5
      }
    }
  }
  dependsOn: [agentApp]
}

// Outputs
output webUrl string = 'https://${webApp.properties.configuration.ingress.fqdn}'
output agentUrl string = 'https://${agentApp.properties.configuration.ingress.fqdn}'
output pgHost string = pgServer.properties.fullyQualifiedDomainName
output pgConnStr string = databaseUrl
```

---

### Step 6: Deploy to Azure

```bash
cd /home/aparna/Desktop/vercel-ai-sdk

# Validate Bicep template (no cost)
echo "🔍 Validating Bicep..."
az deployment group validate \
  --resource-group $RG \
  --template-file infra/main.bicep \
  --parameters \
    "prefix=$PREFIX" \
    "location=$LOCATION" \
    "pgAdminPassword=$PG_ADMIN_PASSWORD" \
    "nextAuthSecret=$NEXTAUTH_SECRET" \
    "azureOpenAiKey=$AZURE_OPENAI_API_KEY" \
    "azureOpenAiEndpoint=$AZURE_OPENAI_ENDPOINT" \
    "azureOpenAiDeployment=$AZURE_OPENAI_DEPLOYMENT_NAME" \
    "acrServer=${ACR_NAME}.azurecr.io" \
    "acrUsername=$ACR_USER" \
    "acrPassword=$ACR_PASS"

# Deploy (takes 10-15 minutes)
echo "🏗️  Deploying..."
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group $RG \
  --template-file infra/main.bicep \
  --name "techtrend-$(date +%Y%m%d-%H%M%S)" \
  --parameters \
    "prefix=$PREFIX" \
    "location=$LOCATION" \
    "pgAdminPassword=$PG_ADMIN_PASSWORD" \
    "nextAuthSecret=$NEXTAUTH_SECRET" \
    "azureOpenAiKey=$AZURE_OPENAI_API_KEY" \
    "azureOpenAiEndpoint=$AZURE_OPENAI_ENDPOINT" \
    "azureOpenAiDeployment=$AZURE_OPENAI_DEPLOYMENT_NAME" \
    "acrServer=${ACR_NAME}.azurecr.io" \
    "acrUsername=$ACR_USER" \
    "acrPassword=$ACR_PASS" \
  --output json)

# Extract outputs
WEB_URL=$(echo $DEPLOY_OUTPUT | jq -r '.properties.outputs.webUrl.value')
AGENT_URL=$(echo $DEPLOY_OUTPUT | jq -r '.properties.outputs.agentUrl.value')
DATABASE_URL=$(echo $DEPLOY_OUTPUT | jq -r '.properties.outputs.pgConnStr.value')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Web:   $WEB_URL"
echo "🤖 Agent: $AGENT_URL"
echo "🐘 PG:    $(echo $DATABASE_URL | cut -d'@' -f2)"
echo ""

# Save outputs
cat > /tmp/deploy-outputs.sh << EOF
export WEB_URL="$WEB_URL"
export AGENT_URL="$AGENT_URL"
export DATABASE_URL="$DATABASE_URL"
EOF
chmod 600 /tmp/deploy-outputs.sh
```

---

### Step 7: Run Migrations on Azure DB

```bash
source /tmp/deploy-outputs.sh

cd apps/web

# Run migrations
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

# Seed test data
DATABASE_URL="$DATABASE_URL" npx prisma db seed

# Embed products with Azure OpenAI
DATABASE_URL="$DATABASE_URL" \
AZURE_OPENAI_API_KEY="$AZURE_OPENAI_API_KEY" \
AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
  pnpm embed

# Verify pgvector search
psql "$DATABASE_URL" -c "
  SELECT name, price FROM \"Product\"
  ORDER BY embedding <=> (
    SELECT embedding FROM \"Product\"
    WHERE name ILIKE '%sony%' LIMIT 1
  ) LIMIT 3;
"
```

---

### Step 8: Verify Deployment

```bash
source /tmp/deploy-outputs.sh

# 1. Health check
curl "$WEB_URL/api/health"
# Expected: {"status":"ok","postgres":true,"redis":true}

# 2. Agent alive
curl "$AGENT_URL/ok"
# Expected: 200 OK

# 3. Container Apps status
az containerapp list -g $RG \
  --query "[].{name:name,state:properties.runningStatus,fqdn:properties.configuration.ingress.fqdn}" \
  -o table

# 4. PostgreSQL status
az postgres flexible-server show \
  -g $RG -n techtrend-pg \
  --query "{name:name,state:properties.state}" \
  -o table
```

---

## 📊 POST-DEPLOYMENT VERIFICATION

### Run Cypress E2E Against Production

```bash
source /tmp/deploy-outputs.sh

cd apps/web

# Mocked tests (fast, no LLM cost)
CYPRESS_BASE_URL="$WEB_URL" \
  pnpm cy:run --spec "cypress/e2e/mocked/security.cy.ts"

# Real LLM smoke tests (slow, uses Azure OpenAI)
CYPRESS_BASE_URL="$WEB_URL" \
  pnpm cy:run:real
```

### Run LLM Evaluations

```bash
cd apps/agent

# Full eval (32 cases, ~5 min)
pnpm eval

# Quick eval (10 cases, ~2 min)
npx tsx src/evals/quick-eval.ts
```

**Expected Results**:
- Tool Selection: ≥90%
- Parameter Quality: ≥85%
- Hallucination: 100%

---

## 💰 COST MANAGEMENT

### Free Tier Limits (12 Months)

| Service | Free Tier | Your Usage | Overage Cost |
|---------|-----------|------------|--------------|
| Container Apps | 180K vCPU-sec/month | ~50K (2 apps × 0.5 CPU × 24/7) | $0 |
| PostgreSQL B1ms | 750 hrs/month, 32GB | 744 hrs (24/7) | $0 |
| Container Registry | 10GB storage | ~2GB (2 images) | $0 |
| Redis | Included in Container Apps | 0.5GB | $0 |
| Azure OpenAI | $200 credit (30 days) | ~$10-20/month | After 30 days: ~$10-20/month |

**Total First 12 Months**: ~$10-20/month (mostly Azure OpenAI)  
**After 12 Months**: ~$40-50/month

### Cost Optimization Tips

1. **Scale to zero when not in use**:
   ```bash
   az containerapp update -g $RG -n techtrend-web --min-replicas 0
   az containerapp update -g $RG -n techtrend-agent --min-replicas 0
   ```

2. **Use smaller PostgreSQL tier** (if available in your region):
   ```bash
   az postgres flexible-server update -g $RG -n techtrend-pg --sku-name Standard_B1s
   ```

3. **Monitor with Azure Cost Management**:
   ```bash
   az consumption budget create \
     --resource-group $RG \
     --name monthly-budget \
     --amount 50 \
     --time-grain monthly
   ```

---

## 🚨 TROUBLESHOOTING

### Deployment Fails with "Name Already Taken"

**Solution**: ACR names must be globally unique. Change `ACR_NAME` in `/tmp/techtrend-deploy.sh`:
```bash
export ACR_NAME="techtrendarc$(openssl rand -hex 4)"
```

### pgvector Extension Not Enabled

**Solution**: Manually enable via psql:
```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Container App Won't Start

**Check logs**:
```bash
az containerapp logs show -g $RG -n techtrend-agent --follow --tail 50
```

**Common issues**:
- Missing environment variables → Check `az containerapp show`
- Image pull errors → Verify ACR credentials
- Port mismatch → Verify `targetPort` in Bicep

### Health Check Fails

**Web app**:
```bash
curl "$WEB_URL/api/health"
# If postgres:false → Check DATABASE_URL secret
# If redis:false → Check REDIS_URL env var
```

**Agent**:
```bash
curl "$AGENT_URL/ok"
# If 404 → Check container is running
# If 500 → Check Azure OpenAI credentials
```

---

## 📝 ROLLBACK PROCEDURE

### Roll Back to Previous Image

```bash
# Get previous image tag
az acr repository show-tags --name $ACR_NAME --repository techtrend-web --orderby time_desc --top 2

# Deploy previous version
az containerapp update \
  -g $RG -n techtrend-web \
  --image ${ACR_SERVER}/techtrend-web:PREVIOUS_TAG
```

### Stop All Containers (Emergency)

```bash
az containerapp update -g $RG -n techtrend-web --min-replicas 0
az containerapp update -g $RG -n techtrend-agent --min-replicas 0
```

---

## 📊 MONITORING

### View Logs

```bash
# Web app logs
az containerapp logs show -g $RG -n techtrend-web --follow

# Agent logs
az containerapp logs show -g $RG -n techtrend-agent --follow
```

### Container App Metrics

```bash
# CPU usage
az monitor metrics list \
  --resource $(az containerapp show -g $RG -n techtrend-web --query id -o tsv) \
  --metric "CpuUsage" \
  --interval PT1M \
  --output table

# Memory usage
az monitor metrics list \
  --resource $(az containerapp show -g $RG -n techtrend-web --query id -o tsv) \
  --metric "MemoryUsage" \
  --interval PT1M \
  --output table
```

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Azure CLI authenticated
- [ ] Resource group created
- [ ] Container Registry created
- [ ] Docker images built and pushed
- [ ] Bicep template validated
- [ ] Deployment completed (10-15 min)
- [ ] Migrations run on Azure DB
- [ ] Products embedded with pgvector
- [ ] Health checks passing
- [ ] Cypress E2E passing against production
- [ ] LLM evals meeting targets
- [ ] Monitoring configured

---

## 🎯 SUCCESS CRITERIA

Deployment is successful when:

1. ✅ Web app accessible at `https://techtrend-web.XXX.azurecontainerapps.io`
2. ✅ Agent accessible at `https://techtrend-agent.XXX.azurecontainerapps.io`
3. ✅ Health check returns `{"status":"ok","postgres":true,"redis":true}`
4. ✅ Cypress E2E smoke tests pass against production
5. ✅ LLM evals meet targets (tool selection ≥90%, hallucination 100%)
6. ✅ pgvector semantic search working on Azure DB

---

**Generated**: 2026-03-24  
**Version**: 1.0  
**Status**: Ready for deployment
