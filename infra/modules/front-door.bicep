// Azure Front Door Standard — CDN, DDoS protection, optional WAF
param suffix string
param location string = 'global' // Front Door is always global

@description('Backend hostname for the API app (e.g. app-api-fuelripple-prod.azurewebsites.net)')
param apiBackendHostname string

@description('Backend hostname for the Web app (e.g. app-web-fuelripple-prod.azurewebsites.net)')
param webBackendHostname string

// Front Door Profile (Standard SKU)
resource profile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: 'afd-${suffix}'
  location: location
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
}

// ── API Origin Group & Route ──

resource apiOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: profile
  name: 'og-api'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

resource apiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: apiOriginGroup
  name: 'origin-api'
  properties: {
    hostName: apiBackendHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: apiBackendHostname
    priority: 1
    weight: 1000
    enforceCertificateNameCheck: true
  }
}

// ── Web Origin Group & Route ──

resource webOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: profile
  name: 'og-web'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

resource webOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: webOriginGroup
  name: 'origin-web'
  properties: {
    hostName: webBackendHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: webBackendHostname
    priority: 1
    weight: 1000
    enforceCertificateNameCheck: true
  }
}

// ── Endpoint ──

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: profile
  name: 'ep-${suffix}'
  location: location
  properties: {
    enabledState: 'Enabled'
  }
}

// ── Routes ──

// API route: /api/* → API origin
resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'route-api'
  properties: {
    originGroup: {
      id: apiOriginGroup.id
    }
    patternsToMatch: [
      '/api/*'
      '/health'
    ]
    supportedProtocols: [
      'Https'
    ]
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    cacheConfiguration: null // no caching for API
  }
  dependsOn: [
    apiOrigin
  ]
}

// Web route: /* → Web origin (SPA)
resource webRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'route-web'
  properties: {
    originGroup: {
      id: webOriginGroup.id
    }
    patternsToMatch: [
      '/*'
    ]
    supportedProtocols: [
      'Https'
    ]
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    cacheConfiguration: {
      queryStringCachingBehavior: 'IgnoreQueryString'
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: [
          'text/html'
          'text/css'
          'application/javascript'
          'application/json'
          'image/svg+xml'
          'application/font-woff2'
        ]
      }
    }
  }
  dependsOn: [
    webOrigin
    apiRoute // API route must be created first so it has higher priority
  ]
}

// Outputs
output endpointHostname string = endpoint.properties.hostName
output frontDoorUrl string = 'https://${endpoint.properties.hostName}'
output frontDoorId string = profile.properties.frontDoorId
