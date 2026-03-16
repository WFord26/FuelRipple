// ================================================================
// FuelRipple — Azure Monitor: Log Analytics + Application Insights
// ================================================================

@description('Suffix used for all resource names (e.g. fuelripple-dev)')
param suffix string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Log retention in days. Free tier max is 31.')
@minValue(7)
@maxValue(90)
param retentionDays int = 30

// ── Log Analytics Workspace ──────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${suffix}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionDays
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Application Insights (workspace-based) ───────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${suffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: retentionDays
    DisableIpMasking: false
    IngestionMode: 'LogAnalytics'
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────
@description('Application Insights connection string (includes instrumentation key)')
output connectionString string = appInsights.properties.ConnectionString

@description('Classic instrumentation key (for legacy SDKs)')
output instrumentationKey string = appInsights.properties.InstrumentationKey

@description('Resource ID of the Application Insights component')
output resourceId string = appInsights.id

@description('Resource ID of the Log Analytics workspace')
output workspaceId string = logAnalytics.id
