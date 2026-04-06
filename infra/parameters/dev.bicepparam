using '../main.bicep'

param environment = 'dev'
param location = 'westus3'
param projectName = 'fuelripple-wford'
param apiImageTag = 'latest'
param webImageTag = 'latest'
param appServiceSkuName = 'B1'
param enableRedis = true
param enableFrontDoor = true

// Alert notifications
param alertEmails = readEnvironmentVariable('ALERT_EMAILS', '')
param webhookUrl = readEnvironmentVariable('ALERT_WEBHOOK_URL', '')

// Secrets — supply at deployment time via --parameters or key vault
param dbPassword = readEnvironmentVariable('DB_PASSWORD', '')
param eiaApiKey = readEnvironmentVariable('EIA_API_KEY', '')
param fredApiKey = readEnvironmentVariable('FRED_API_KEY', '')
