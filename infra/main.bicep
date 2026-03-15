// ============================================================
// FuelRipple — Azure Infrastructure (App Service + Containers)
// Main orchestration template
// ============================================================

targetScope = 'resourceGroup'

@description('The environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Project name used as prefix for resource naming')
param projectName string = 'fuelripple'

@secure()
@description('PostgreSQL administrator password')
param dbPassword string

@secure()
@description('EIA API key')
param eiaApiKey string

@secure()
@description('FRED API key')
param fredApiKey string

@description('API container image tag (e.g., latest, v1.0.0, sha-abc123)')
param apiImageTag string = 'latest'

@description('Web container image tag')
param webImageTag string = 'latest'

@description('App Service Plan SKU')
param appServiceSkuName string = 'B2'

@description('Deploy Redis ACI for L2 caching and BullMQ job scheduling. When false, the API falls back to in-memory LRU cache and disables BullMQ.')
param enableRedis bool = false

@description('Deploy Azure Front Door Standard for CDN, DDoS protection, and global edge caching.')
param enableFrontDoor bool = false

// Naming convention
var suffix = '${projectName}-${environment}'
var acrName = replace('acr${projectName}${environment}', '-', '')

// Container Registry
module acr 'modules/container-registry.bicep' = {
  name: 'acr'
  params: {
    name: acrName
    location: location
  }
}

// Virtual Network
module network 'modules/networking.bicep' = {
  name: 'networking'
  params: {
    suffix: suffix
    location: location
  }
}

// Storage for persistent volumes (Redis data) — only when Redis is enabled
module storage 'modules/storage.bicep' = if (enableRedis) {
  name: 'storage'
  params: {
    suffix: suffix
    location: location
  }
}

// PostgreSQL Flexible Server (Burstable B1ms + TimescaleDB)
module database 'modules/postgres-flexible.bicep' = {
  name: 'postgres'
  params: {
    suffix: suffix
    location: location
    administratorPassword: dbPassword
  }
}

// Redis Container Instance — optional
module redis 'modules/aci-redis.bicep' = if (enableRedis) {
  name: 'aci-redis'
  params: {
    suffix: suffix
    location: location
    subnetId: network.outputs.aciSubnetId
    storageAccountName: storage.?outputs.storageAccountName ?? ''
    storageAccountKey: storage.?outputs.storageAccountKey ?? ''
    redisFileShareName: storage.?outputs.redisFileShareName ?? ''
  }
}

// Deterministic App Service hostnames (avoids circular dependency with Front Door)
var apiHostname = 'app-api-${suffix}.azurewebsites.net'
var webHostname = 'app-web-${suffix}.azurewebsites.net'

// Azure Front Door Standard — optional (must deploy before App Service so its ID is available)
module frontDoor 'modules/front-door.bicep' = if (enableFrontDoor) {
  name: 'front-door'
  params: {
    suffix: suffix
    apiBackendHostname: apiHostname
    webBackendHostname: webHostname
  }
}

// App Service (API + Web)
module appService 'modules/app-service.bicep' = {
  name: 'app-service'
  params: {
    suffix: suffix
    location: location
    skuName: appServiceSkuName
    acrLoginServer: acr.outputs.loginServer
    acrName: acrName
    apiImageTag: apiImageTag
    webImageTag: webImageTag
    appSubnetId: network.outputs.appSubnetId
    databaseHost: database.outputs.fqdn
    dbPassword: dbPassword
    redisHost: enableRedis ? (redis.?outputs.fqdn ?? '') : ''
    eiaApiKey: eiaApiKey
    fredApiKey: fredApiKey
    environment: environment
    frontDoorId: enableFrontDoor ? (frontDoor.?outputs.frontDoorId ?? '') : ''
    corsOrigin: enableFrontDoor ? (frontDoor.?outputs.frontDoorUrl ?? '') : ''
  }
}

// Outputs
output acrLoginServer string = acr.outputs.loginServer
output apiUrl string = appService.outputs.apiUrl
output webUrl string = appService.outputs.webUrl
output databaseFqdn string = database.outputs.fqdn
output redisFqdn string = enableRedis ? (redis.?outputs.fqdn ?? 'disabled') : 'disabled'
output redisEnabled bool = enableRedis
output databaseConnectionString string = database.outputs.connectionString
output frontDoorEnabled bool = enableFrontDoor
output frontDoorUrl string = enableFrontDoor ? (frontDoor.?outputs.frontDoorUrl ?? '') : ''
output frontDoorEndpointCname string = enableFrontDoor ? (frontDoor.?outputs.endpointCname ?? '') : ''

// DNS setup — create these records at your registrar after deployment
// CNAME  www           → <frontDoorEndpointCname>
// ALIAS  @             → <frontDoorEndpointCname>  (or CNAME if provider supports apex)
// CNAME  api           → <frontDoorEndpointCname>
// TXT    _dnsauth.www  → <wwwValidationToken>
// TXT    _dnsauth      → <apexValidationToken>      (apex = no subdomain prefix)
// TXT    _dnsauth.api  → <apiValidationToken>
output wwwValidationToken string = enableFrontDoor ? (frontDoor.?outputs.wwwValidationToken ?? '') : ''
output apexValidationToken string = enableFrontDoor ? (frontDoor.?outputs.apexValidationToken ?? '') : ''
output apiValidationToken string = enableFrontDoor ? (frontDoor.?outputs.apiValidationToken ?? '') : ''
