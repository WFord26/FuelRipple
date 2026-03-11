// Storage Account + File Shares for persistent container volumes (Redis)
param suffix string
param location string

var storageName = replace('st${suffix}', '-', '')

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: length(storageName) > 24 ? substring(storageName, 0, 24) : storageName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource fileServices 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource redisFileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileServices
  name: 'redisdata'
  properties: {
    shareQuota: 1
  }
}

output storageAccountName string = storageAccount.name

#disable-next-line outputs-should-not-contain-secrets
output storageAccountKey string = storageAccount.listKeys().keys[0].value
output redisFileShareName string = redisFileShare.name
