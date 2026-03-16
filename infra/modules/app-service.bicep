// App Service Plan + Web Apps for API and Web frontend
param suffix string
param location string
param skuName string
param acrLoginServer string
param acrName string
param apiImageTag string
param webImageTag string
param appSubnetId string
param databaseHost string

@secure()
param dbPassword string
@description('Redis host IP. Empty string means Redis is disabled.')
param redisHost string

@secure()
param eiaApiKey string

@secure()
param fredApiKey string

@description('Environment name, used in CORS origin URL')
param environment string

@description('Azure Front Door ID for access restriction. Empty string means Front Door is disabled.')
param frontDoorId string = ''

@description('CORS allowed origin. Defaults to the web App Service URL if not set.')
param corsOrigin string = ''

// App Service Plan (Linux)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'plan-${suffix}'
  location: location
  kind: 'linux'
  sku: {
    name: skuName
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// Reference ACR for managed identity pull
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

// ──────────────────────────────────────────────
// API Web App
// ──────────────────────────────────────────────
resource apiApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-api-${suffix}'
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    virtualNetworkSubnetId: appSubnetId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/fuelripple-api:${apiImageTag}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      healthCheckPath: '/health'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      ipSecurityRestrictions: frontDoorId != '' ? [
        {
          tag: 'ServiceTag'
          ipAddress: 'AzureFrontDoor.Backend'
          action: 'Allow'
          priority: 100
          name: 'AllowFrontDoor'
          headers: {
            'x-azure-fdid': [
              frontDoorId
            ]
          }
        }
        {
          ipAddress: 'Any'
          action: 'Deny'
          priority: 2147483647
          name: 'DenyAll'
        }
      ] : []
      ipSecurityRestrictionsDefaultAction: frontDoorId != '' ? 'Deny' : 'Allow'
      appSettings: [
        // Container Registry
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        // Application
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '3001'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3001'
        }
        {
          name: 'DATABASE_URL'
          value: 'postgresql://fuelripple:${dbPassword}@${databaseHost}:5432/gastracker?sslmode=require'
        }
        {
          name: 'REDIS_URL'
          value: redisHost != '' ? 'redis://${redisHost}:6379' : ''
        }
        {
          name: 'EIA_API_KEY'
          value: eiaApiKey
        }
        {
          name: 'FRED_API_KEY'
          value: fredApiKey
        }
        {
          name: 'CORS_ORIGIN'
          value: corsOrigin != '' ? '${corsOrigin},https://fuelripple.com' : 'https://app-web-${suffix}.azurewebsites.net'
        }
        {
          name: 'ENVIRONMENT'
          value: environment
        }
      ]
    }
  }
}

// Grant API App managed identity AcrPull role on ACR
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource apiAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, apiApp.id, acrPullRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// API Autoscale (only supported on Standard / Premium tiers)
var isBasicSku = startsWith(skuName, 'B')
resource apiAutoscale 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (!isBasicSku) {
  name: 'autoscale-api-${suffix}'
  location: location
  properties: {
    targetResourceUri: appServicePlan.id
    enabled: true
    profiles: [
      {
        name: 'Auto created scale condition'
        capacity: {
          minimum: '1'
          maximum: '3'
          default: '1'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              operator: 'GreaterThan'
              statistic: 'Average'
              threshold: 70
              timeAggregation: 'Average'
              timeGrain: 'PT1M'
              timeWindow: 'PT5M'
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              operator: 'LessThan'
              statistic: 'Average'
              threshold: 30
              timeAggregation: 'Average'
              timeGrain: 'PT1M'
              timeWindow: 'PT10M'
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
  }
}

// ──────────────────────────────────────────────
// Web Frontend App
// ──────────────────────────────────────────────
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-web-${suffix}'
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    virtualNetworkSubnetId: appSubnetId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/fuelripple-web:${webImageTag}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      healthCheckPath: '/'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      ipSecurityRestrictions: frontDoorId != '' ? [
        {
          tag: 'ServiceTag'
          ipAddress: 'AzureFrontDoor.Backend'
          action: 'Allow'
          priority: 100
          name: 'AllowFrontDoor'
          headers: {
            'x-azure-fdid': [
              frontDoorId
            ]
          }
        }
        {
          ipAddress: 'Any'
          action: 'Deny'
          priority: 2147483647
          name: 'DenyAll'
        }
      ] : []
      ipSecurityRestrictionsDefaultAction: frontDoorId != '' ? 'Deny' : 'Allow'
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'API_URL'
          value: 'https://app-api-${suffix}.azurewebsites.net'
        }
      ]
    }
  }
}

// Grant Web App managed identity AcrPull role on ACR
resource webAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, webApp.id, acrPullRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output webUrl string = 'https://${webApp.properties.defaultHostName}'
output apiHostname string = apiApp.properties.defaultHostName
output webHostname string = webApp.properties.defaultHostName
output apiAppName string = apiApp.name
output webAppName string = webApp.name
output appServicePlanName string = appServicePlan.name
