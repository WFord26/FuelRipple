# FuelRipple — Azure Deployment Guide

## Architecture Overview

```
                    ┌──────────────────────────────────────┐
                    │         Azure Resource Group          │
                    │         (rg-fuelripple-{env})         │
                    │                                      │
    Internet ──────►│  ┌─────────────────────────────────┐ │
                    │  │    App Service Plan (Linux)      │ │
                    │  │  ┌───────────┐ ┌──────────────┐ │ │
                    │  │  │  API App  │ │   Web App    │ │ │
                    │  │  │ (Express) │ │   (nginx)    │ │ │
                    │  │  └─────┬─────┘ └──────────────┘ │ │
                    │  └────────┼─────────────────────────┘ │
                    │           │  VNet (10.0.0.0/16)       │
                    │  ┌────────┼─────────────────────────┐ │
                    │  │  ┌─────▼─────┐  ┌─────────────┐ │ │
                    │  │  │TimescaleDB│  │    Redis     │ │ │
                    │  │  │   (ACI)   │  │    (ACI)     │ │ │
                    │  │  └─────┬─────┘  └──────┬──────┘ │ │
                    │  └────────┼────────────────┼────────┘ │
                    │     ┌─────▼────────────────▼──────┐   │
                    │     │   Azure File Shares          │   │
                    │     │  (pgdata / redisdata)        │   │
                    │     └─────────────────────────────┘   │
                    │                                      │
                    │  ┌─────────────────────────────────┐ │
                    │  │  Azure Container Registry (ACR) │ │
                    │  └─────────────────────────────────┘ │
                    └──────────────────────────────────────┘
```

| Component | Azure Service | Purpose |
|-----------|---------------|---------|
| API | App Service (Linux Container) | Express.js API with BullMQ workers |
| Web | App Service (Linux Container) | Vite SPA served via nginx |
| Database | ACI (TimescaleDB/PG16) | Time-series data, persistent via Azure File Share |
| Cache/Queue | ACI (Redis 7) | Caching + BullMQ job queue backing store |
| Image Store | Azure Container Registry | Docker images for API + Web |
| Networking | Virtual Network | Private communication between App Service and ACI |
| Storage | Storage Account + File Shares | Persistent volumes for DB and Redis |

---

## Prerequisites

1. **Azure CLI** installed and logged in (`az login`)
2. **Docker** installed locally (for building/testing images)
3. **GitHub repo** with Actions enabled
4. An Azure **subscription** with permissions to create resources

---

## 1. One-Time Azure Setup

### 1.1 Create a Service Principal for GitHub Actions (OIDC)

```bash
# Set your subscription
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# Create a service principal with Contributor role
az ad sp create-for-rbac \
  --name "sp-fuelripple-github" \
  --role Contributor \
  --scopes /subscriptions/<YOUR_SUBSCRIPTION_ID> \
  --sdk-auth
```

### 1.2 Configure OIDC Federated Credentials

For passwordless GitHub Actions auth (recommended over secrets):

```bash
APP_ID=$(az ad sp list --display-name "sp-fuelripple-github" --query "[0].appId" -o tsv)

# For main branch (prod)
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<YOUR_GITHUB_ORG>/<YOUR_REPO>:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

# For develop branch (dev)
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-develop",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<YOUR_GITHUB_ORG>/<YOUR_REPO>:ref:refs/heads/develop",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

### 1.3 Add GitHub Secrets

In your repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | Service principal App ID |
| `AZURE_TENANT_ID` | Your Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your subscription ID |
| `DB_PASSWORD` | Strong password for TimescaleDB |
| `EIA_API_KEY` | Your EIA API key |
| `FRED_API_KEY` | Your FRED API key |
| `DATABASE_URL` | `postgresql://fuelripple:<DB_PASSWORD>@<DB_IP>:5432/gastracker` |

---

## 2. Manual Deployment (First Time)

If you prefer to deploy manually before setting up CI/CD:

### 2.1 Create Resource Group

```bash
az group create --name rg-fuelripple-dev --location eastus2
```

### 2.2 Deploy Infrastructure

```bash
# Set environment variables for secrets
export DB_PASSWORD="<your-strong-password>"
export EIA_API_KEY="<your-eia-key>"
export FRED_API_KEY="<your-fred-key>"

# Deploy
az deployment group create \
  --resource-group rg-fuelripple-dev \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

### 2.3 Build and Push Docker Images

```bash
# Get ACR login server
ACR_NAME=acrfuelrippledev
az acr login --name $ACR_NAME
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

# Build from repo root (context is the monorepo root)
docker build -f apps/api/Dockerfile -t $ACR_SERVER/fuelripple-api:latest .
docker build -f apps/web/Dockerfile -t $ACR_SERVER/fuelripple-web:latest .

# Push
docker push $ACR_SERVER/fuelripple-api:latest
docker push $ACR_SERVER/fuelripple-web:latest
```

### 2.4 Run Database Migrations

```bash
# Get the database FQDN from deployment output
DB_FQDN=$(az deployment group show \
  --resource-group rg-fuelripple-dev \
  --name main \
  --query properties.outputs.databaseFqdn.value -o tsv)

# Run migrations
DATABASE_URL="postgresql://fuelripple:${DB_PASSWORD}@${DB_FQDN}:5432/gastracker?sslmode=require" \
  npm run db:migrate
```

---

## 3. CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automates the full deployment:

| Trigger | Environment |
|---------|-------------|
| Push to `develop` | dev |
| Push to `main` | prod |
| Manual dispatch | Selectable |

**Pipeline stages:**

1. **Setup** → Determine environment, image tag (git SHA)
2. **Build** → Build API + Web Docker images in parallel, push to ACR
3. **Infra** → Deploy/update Bicep templates
4. **Deploy** → Update App Service containers to new image tag
5. **Migrate** → Run Knex database migrations
6. **Smoke Test** → Health check both API and Web endpoints

---

## 4. Environment Variables Reference

### API App Service

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API listen port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...?sslmode=require` |
| `REDIS_URL` | Redis connection string (empty = disabled) | `redis://10.0.2.x:6379` or empty |
| `EIA_API_KEY` | EIA data API key | `abc123...` |
| `FRED_API_KEY` | FRED economic data API key | `xyz789...` |
| `CORS_ORIGIN` | Allowed frontend origin | `https://app-web-...azurewebsites.net` |

### Web App Service

| Variable | Description | Example |
|----------|-------------|---------|
| `API_URL` | Backend API URL (for nginx proxy) | `https://app-api-...azurewebsites.net` |
| `WEBSITES_PORT` | Container listen port | `8080` |

---

## 5. Scaling & Cost Estimates

### Dev Environment — without Redis (default)

| Resource | SKU | Est. Monthly Cost |
|----------|-----|-------------------|
| App Service Plan (B1) | 1 vCPU, 1.75 GB | ~$13 |
| PostgreSQL Flexible Server (B1ms) | 1 vCPU, 2 GB, 32 GB storage | ~$13 |
| ACR (Basic) | 10 GB storage | ~$5 |
| **Total** | | **~$31/mo** |

### Dev Environment — with Redis (`enableRedis=true`)

| Resource | SKU | Est. Monthly Cost |
|----------|-----|-------------------|
| App Service Plan (B1) | 1 vCPU, 1.75 GB | ~$13 |
| PostgreSQL Flexible Server (B1ms) | 1 vCPU, 2 GB, 32 GB storage | ~$13 |
| ACI – Redis | 1 vCPU, 1 GB | ~$35 |
| ACR (Basic) | 10 GB storage | ~$5 |
| Storage Account | LRS, 1 GB share | ~$1 |
| **Total** | | **~$67/mo** |

### Prod Environment (B2 plan, without Redis)

| Resource | SKU | Est. Monthly Cost |
|----------|-----|-------------------|
| App Service Plan (B2) | 2 vCPU, 3.5 GB | ~$55 |
| PostgreSQL Flexible Server (B1ms) | 1 vCPU, 2 GB, 32 GB storage | ~$13 |
| ACR (Basic) | 10 GB storage | ~$5 |
| **Total** | | **~$73/mo** |

### Optional Add-ons

| Add-on | Param | Est. Monthly Cost |
|--------|-------|-------------------|
| Azure Front Door Standard | `enableFrontDoor = true` | ~$35 + transfer |
| ACI Redis | `enableRedis = true` | ~$35 + ~$1 storage |

### Scaling Notes

- App Service autoscale is configured for **Standard / Premium tiers only** (skipped on Basic SKUs). With the current B2 prod plan, scaling is manual via Azure Portal or CLI.
- Redis is **optional** (`enableRedis` param in Bicep). Without it the API uses in-memory LRU cache; scheduled BullMQ jobs are disabled but manual backfills still work.
- **Azure Front Door Standard** is **optional** (`enableFrontDoor` param). When enabled it provides global CDN edge caching, DDoS protection, health probes, and locks down App Service to only accept traffic from Front Door via IP restrictions + `X-Azure-FDID` header validation.
- To enable Redis later: set `enableRedis = true` in your `.bicepparam` file and redeploy
- To enable Front Door later: set `enableFrontDoor = true` in your `.bicepparam` file and redeploy
- For higher database load, upgrade the Flexible Server SKU (B2s, GP D2s_v3)
- To enable autoscale, upgrade the App Service Plan to S1 or P1v3

---

## 6. Monitoring & Troubleshooting

### View Logs

```bash
# API logs
az webapp log tail --name app-api-fuelripple-dev --resource-group rg-fuelripple-dev

# Database logs
az postgres flexible-server show --name psql-fuelripple-dev --resource-group rg-fuelripple-dev

# ACI (Redis) logs — only if enableRedis=true
az container logs --name aci-redis-fuelripple-dev --resource-group rg-fuelripple-dev
```

### Health Checks

```bash
# API health
curl https://app-api-fuelripple-dev.azurewebsites.net/health

# Web
curl -I https://app-web-fuelripple-dev.azurewebsites.net/
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Container won't start | Check `az webapp log tail` for startup errors |
| DB connection refused | Verify Flexible Server is running and firewall allows Azure services |
| ACR pull fails | Ensure managed identity has AcrPull role; check `az role assignment list` |
| Migrations fail | Verify `DATABASE_URL` includes `?sslmode=require`; check Flexible Server firewall |

---

## 7. Teardown

```bash
# Remove all resources for an environment
az group delete --name rg-fuelripple-dev --yes --no-wait

# Remove service principal (optional)
az ad sp delete --id $(az ad sp list --display-name "sp-fuelripple-github" --query "[0].id" -o tsv)
```
