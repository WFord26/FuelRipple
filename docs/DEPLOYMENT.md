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

**Bash**
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

**PowerShell**
```powershell
# Set your subscription
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# Create a service principal with Contributor role
az ad sp create-for-rbac `
  --name "sp-fuelripple-github" `
  --role Contributor `
  --scopes "/subscriptions/<YOUR_SUBSCRIPTION_ID>" `
  --sdk-auth
```

### 1.2 Configure OIDC Federated Credentials

For passwordless GitHub Actions auth (recommended over secrets):

**Bash**
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

**PowerShell**
```powershell
$APP_ID = az ad sp list --display-name "sp-fuelripple-github" --query "[0].appId" -o tsv

# For main branch (prod)
$credMain = @{
  name      = "github-main"
  issuer    = "https://token.actions.githubusercontent.com"
  subject   = "repo:<YOUR_GITHUB_ORG>/<YOUR_REPO>:ref:refs/heads/main"
  audiences = @("api://AzureADTokenExchange")
} | ConvertTo-Json -Compress
az ad app federated-credential create --id $APP_ID --parameters $credMain

# For develop branch (dev)
$credDev = @{
  name      = "github-develop"
  issuer    = "https://token.actions.githubusercontent.com"
  subject   = "repo:<YOUR_GITHUB_ORG>/<YOUR_REPO>:ref:refs/heads/develop"
  audiences = @("api://AzureADTokenExchange")
} | ConvertTo-Json -Compress
az ad app federated-credential create --id $APP_ID --parameters $credDev
```

### 1.3 Add GitHub Secrets

Secrets are scoped to **GitHub Environments** (`dev` and `prod`). In your repo → Settings → Environments, create both environments, then add the following secrets to each:

| Secret | Value |
|--------|-------|
| `ACR_LOGIN_SERVER` | ACR login server, e.g. `acrfuelrippledev.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `FUELRIPPLE_AZURE_CLIENT_ID` | Service principal App ID (OIDC) |
| `FUELRIPPLE_AZURE_TENANT_ID` | Your Azure AD tenant ID |
| `FUELRIPPLE_AZURE_SUBSCRIPTION_ID` | Your subscription ID |
| `DB_PASSWORD` | Strong password for TimescaleDB |
| `EIA_API_KEY` | Your EIA API key |
| `FRED_API_KEY` | Your FRED API key |
| `DATABASE_URL` | `postgresql://fuelripple:<DB_PASSWORD>@<DB_IP>:5432/gastracker?sslmode=require` |

> **ACR admin credentials**: Enable admin user on your ACR via `az acr update --name <ACR_NAME> --admin-enabled true`, then retrieve credentials with `az acr credential show --name <ACR_NAME>`.

---

## 2. Manual Deployment (First Time)

If you prefer to deploy manually before setting up CI/CD:

### 2.1 Create Resource Group

**Bash**
```bash
az group create --name rg-fuelripple-dev --location <YOUR_REGION>
```

**PowerShell**
```powershell
az group create --name rg-fuelripple-dev --location <YOUR_REGION>
```

> Replace `<YOUR_REGION>` with your Azure region (e.g. `westus3`, `eastus`, `centralus`). The Bicep deployment will inherit this location from the resource group, but you can also override it by setting `param location = 'your-region'` in your `.bicepparam` file.

### 2.2 Deploy Infrastructure

**Bash**
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

**PowerShell**
```powershell
# Set environment variables for secrets
$env:DB_PASSWORD  = "<your-strong-password>"
$env:EIA_API_KEY  = "<your-eia-key>"
$env:FRED_API_KEY = "<your-fred-key>"

# Deploy
az deployment group create `
  --resource-group rg-fuelripple-dev `
  --template-file infra/main.bicep `
  --parameters infra/parameters/dev.bicepparam
```

### 2.3 Build and Push Docker Images

**Bash**
```bash
# Get ACR login server
ACR=acrfuelrippledev
az acr login --name $ACR
ACR_SERVER=$(az acr show --name $ACR --query loginServer -o tsv)

# Build from repo root (context is the monorepo root)
docker build -f apps/api/Dockerfile -t $ACR_SERVER/fuelripple-api:latest .
docker build -f apps/web/Dockerfile -t $ACR_SERVER/fuelripple-web:latest .

# Push
docker push $ACR_SERVER/fuelripple-api:latest
docker push $ACR_SERVER/fuelripple-web:latest
```

**PowerShell**
```powershell
# Get ACR login server
$ACR = "acrfuelrippledev"
az acr login --name $ACR
$ACR_SERVER = az acr show --name $ACR --query loginServer -o tsv

# Build from repo root (context is the monorepo root)
docker build -f apps/api/Dockerfile -t "$ACR_SERVER/fuelripple-api:latest" .
docker build -f apps/web/Dockerfile -t "$ACR_SERVER/fuelripple-web:latest" .

# Push
docker push "$ACR_SERVER/fuelripple-api:latest"
docker push "$ACR_SERVER/fuelripple-web:latest"
```

### 2.4 Run Database Migrations

**Bash**
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

**PowerShell**
```powershell
# Get the database FQDN from deployment output
$DB_FQDN = az deployment group show `
  --resource-group rg-fuelripple-dev `
  --name main `
  --query properties.outputs.databaseFqdn.value -o tsv

# Run migrations
$env:DATABASE_URL = "postgresql://fuelripple:$($env:DB_PASSWORD)@${DB_FQDN}:5432/gastracker?sslmode=require"
npm run db:migrate
```

---

## 3. CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automates the full deployment:

| Trigger | Environment |
|---------|-------------|
| Push to `develop` (filtered to `apps/**`, `packages/**`, `infra/**`) | dev |
| Push to `main` (same path filter) | prod |
| Manual dispatch | Selectable, with optional custom image tag and `:latest` toggle |

**Pipeline stages (linear gate: each job blocks the next):**

1. **Test** → Full Turbo test suite with coverage; uploads artifact. Blocks everything else.
2. **Setup** → Resolves environment, ACR host, resource group, and short-SHA image tag.
3. **Build & Push** → Builds API and Web Dockerfiles in parallel using Buildx + GitHub Actions layer cache (`type=gha`); pushes `:<sha>` and `:latest` tags to ACR via `docker/build-push-action`. Writes a step summary per image.
4. **Infra** → Deploys or updates Bicep template for the target environment.
5. **Deploy** → Updates each App Service container image and restarts it; runs a retry health-check loop (10 attempts for API, 6 for Web) and writes a step summary with the live URL.
6. **Migrate** → Runs Knex database migrations via `npm run db:migrate`.

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

**Bash**
```bash
# API logs
az webapp log tail --name app-api-fuelripple-dev --resource-group rg-fuelripple-dev

# Database logs
az postgres flexible-server show --name psql-fuelripple-dev --resource-group rg-fuelripple-dev

# ACI (Redis) logs — only if enableRedis=true
az container logs --name aci-redis-fuelripple-dev --resource-group rg-fuelripple-dev
```

**PowerShell**
```powershell
# API logs
az webapp log tail --name app-api-fuelripple-dev --resource-group rg-fuelripple-dev

# Database logs
az postgres flexible-server show --name psql-fuelripple-dev --resource-group rg-fuelripple-dev

# ACI (Redis) logs — only if enableRedis=true
az container logs --name aci-redis-fuelripple-dev --resource-group rg-fuelripple-dev
```

### Health Checks

**Bash**
```bash
# API health
curl https://app-api-fuelripple-dev.azurewebsites.net/health

# Web
curl -I https://app-web-fuelripple-dev.azurewebsites.net/
```

**PowerShell**
```powershell
# API health
Invoke-RestMethod -Uri https://app-api-fuelripple-dev.azurewebsites.net/health

# Web (check status code)
(Invoke-WebRequest -Uri https://app-web-fuelripple-dev.azurewebsites.net/ -Method Head).StatusCode
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

**Bash**
```bash
# Remove all resources for an environment
az group delete --name rg-fuelripple-dev --yes --no-wait

# Remove service principal (optional)
az ad sp delete --id $(az ad sp list --display-name "sp-fuelripple-github" --query "[0].id" -o tsv)
```

**PowerShell**
```powershell
# Remove all resources for an environment
az group delete --name rg-fuelripple-dev --yes --no-wait

# Remove service principal (optional)
$SP_ID = az ad sp list --display-name "sp-fuelripple-github" --query "[0].id" -o tsv
az ad sp delete --id $SP_ID
```
