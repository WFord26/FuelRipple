// Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
// With TimescaleDB extension enabled
param suffix string
param location string

@secure()
@description('PostgreSQL administrator password')
param administratorPassword string

@description('PostgreSQL administrator login name')
param administratorLogin string = 'fuelripple'

@description('Database name')
param databaseName string = 'gastracker'

@description('Server SKU name')
param skuName string = 'Standard_B1ms'

@description('Server SKU tier')
param skuTier string = 'Burstable'

@description('Storage size in GB')
param storageSizeGB int = 32

@description('Subnet ID for VNet integration (optional)')
param subnetId string = ''

@description('Private DNS Zone ID (optional, required when using VNet)')
param privateDnsZoneId string = ''

var serverName = 'psql-${suffix}'
var useVnet = subnetId != '' && privateDnsZoneId != ''

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: useVnet ? {
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
    } : {}
  }
}

// Allow TimescaleDB extension — must be set before CREATE EXTENSION is called
resource timescaleAllowlist 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgresServer
  name: 'azure.extensions'
  properties: {
    value: 'TIMESCALEDB'
    source: 'user-override'
  }
}

// Preload TimescaleDB shared library (depends on allowlist being set first)
resource timescaleExtConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgresServer
  name: 'shared_preload_libraries'
  properties: {
    value: 'timescaledb'
    source: 'user-override'
  }
  dependsOn: [timescaleAllowlist]
}

// Allow Azure services to connect (when not using VNet)
resource firewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (!useVnet) {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Create the application database
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output fqdn string = postgresServer.properties.fullyQualifiedDomainName
output serverName string = postgresServer.name
output databaseName string = database.name

#disable-next-line outputs-should-not-contain-secrets
output connectionString string = 'postgresql://${administratorLogin}:${administratorPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
