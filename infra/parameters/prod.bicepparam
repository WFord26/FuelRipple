using '../main.bicep'

param environment = 'prod'
param location = 'westus2'
param projectName = 'fuelripple-yourorg'
param apiImageTag = 'latest'
param webImageTag = 'latest'
param appServiceSkuName = 'B2'
param enableRedis = false
param enableFrontDoor = true

// Secrets — supply at deployment time via --parameters or key vault
param dbPassword = readEnvironmentVariable('DB_PASSWORD', '')
param eiaApiKey = readEnvironmentVariable('EIA_API_KEY', '')
param fredApiKey = readEnvironmentVariable('FRED_API_KEY', '')
