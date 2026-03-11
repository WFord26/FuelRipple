using '../main.bicep'

param environment = 'prod'
param location = 'eastus2'
param projectName = 'fuelripple'
param apiImageTag = 'latest'
param webImageTag = 'latest'
param appServiceSkuName = 'B2'
param enableRedis = false
param enableFrontDoor = false

// Secrets — supply at deployment time via --parameters or key vault
param dbPassword = readEnvironmentVariable('DB_PASSWORD', '')
param eiaApiKey = readEnvironmentVariable('EIA_API_KEY', '')
param fredApiKey = readEnvironmentVariable('FRED_API_KEY', '')
