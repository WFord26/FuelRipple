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

// ── Custom Domains (managed TLS certificates auto-provisioned on validation) ──

resource wwwDomain 'Microsoft.Cdn/profiles/customDomains@2023-05-01' = {
  parent: profile
  name: 'www-fuelripple-com'
  properties: {
    hostName: 'www.fuelripple.com'
    tlsSettings: {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    }
  }
}

resource apexDomain 'Microsoft.Cdn/profiles/customDomains@2023-05-01' = {
  parent: profile
  name: 'fuelripple-com'
  properties: {
    hostName: 'fuelripple.com'
    tlsSettings: {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    }
  }
}

resource apiDomain 'Microsoft.Cdn/profiles/customDomains@2023-05-01' = {
  parent: profile
  name: 'api-fuelripple-com'
  properties: {
    hostName: 'api.fuelripple.com'
    tlsSettings: {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    }
  }
}

// ── Rule Set: redirect apex fuelripple.com → www.fuelripple.com ──

resource apexRedirectRuleSet 'Microsoft.Cdn/profiles/ruleSets@2023-05-01' = {
  parent: profile
  name: 'apexToWww'
}

resource apexRedirectRule 'Microsoft.Cdn/profiles/ruleSets/rules@2023-05-01' = {
  parent: apexRedirectRuleSet
  name: 'RedirectToWww'
  properties: {
    order: 1
    conditions: []
    actions: [
      {
        name: 'UrlRedirect'
        parameters: {
          typeName: 'DeliveryRuleUrlRedirectActionParameters'
          redirectType: 'PermanentRedirect'
          destinationProtocol: 'Https'
          customHostname: 'www.fuelripple.com'
        }
      }
    ]
    matchProcessingBehavior: 'Stop'
  }
}

// ── Routes ──

// API route on www + azurefd.net default: /api/* → API origin (no cache)
resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'route-api'
  properties: {
    originGroup: { id: apiOriginGroup.id }
    customDomains: [
      { id: wwwDomain.id }
    ]
    patternsToMatch: [ '/api/*' ]
    supportedProtocols: [ 'Https' ]
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    cacheConfiguration: null
  }
  dependsOn: [ apiOrigin ]
}

// Health route (legacy — /health pattern)
resource healthRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'route-health'
  properties: {
    originGroup: { id: apiOriginGroup.id }
    patternsToMatch: [ '/health' ]
    supportedProtocols: [ 'Https' ]
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    cacheConfiguration: null
  }
  dependsOn: [ apiOrigin ]
}

// api.fuelripple.com: /* → API origin (no cache)
resource apiSubdomainRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'route-api-subdomain'
  properties: {
    originGroup: { id: apiOriginGroup.id }
    customDomains: [
      { id: apiDomain.id }
    ]
    patternsToMatch: [ '/*' ]
    supportedProtocols: [ 'Https' ]
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Disabled'
    cacheConfiguration: null
  }
  dependsOn: [ apiOrigin, apiRoute ]
}

// fuelripple.com apex: /* → redirect to www.fuelripple.com via rule set
resource apexRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'route-apex'
  properties: {
    originGroup: { id: webOriginGroup.id }
    customDomains: [
      { id: apexDomain.id }
    ]
    ruleSets: [
      { id: apexRedirectRuleSet.id }
    ]
    patternsToMatch: [ '/*' ]
    supportedProtocols: [ 'Https' ]
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Disabled'
    cacheConfiguration: null
  }
  dependsOn: [ webOrigin, apexRedirectRule, apiSubdomainRoute ]
}

// www.fuelripple.com: /* → Web origin (SPA, with caching)
resource webRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'route-web'
  properties: {
    originGroup: { id: webOriginGroup.id }
    customDomains: [
      { id: wwwDomain.id }
    ]
    patternsToMatch: [ '/*' ]
    supportedProtocols: [ 'Https' ]
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
          'image/svg+xml'
          'application/font-woff2'
        ]
      }
    }
  }
  dependsOn: [ webOrigin, apiRoute, apiSubdomainRoute, apexRoute ]
}

// Outputs
output endpointHostname string = endpoint.properties.hostName
output frontDoorUrl string = 'https://www.fuelripple.com'
output frontDoorId string = profile.properties.frontDoorId

// DNS validation tokens — read these after deployment to create TXT records
output wwwValidationToken string = wwwDomain.properties.validationProperties.validationToken
output apexValidationToken string = apexDomain.properties.validationProperties.validationToken
output apiValidationToken string = apiDomain.properties.validationProperties.validationToken
output endpointCname string = endpoint.properties.hostName
