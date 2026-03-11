// Redis Container Instance
param suffix string
param location string
param subnetId string
param storageAccountName string

@secure()
param storageAccountKey string
param redisFileShareName string

resource aciRedis 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: 'aci-redis-${suffix}'
  location: location
  properties: {
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Private'
      ports: [
        {
          port: 6379
          protocol: 'TCP'
        }
      ]
    }
    subnetIds: [
      {
        id: subnetId
      }
    ]
    containers: [
      {
        name: 'redis'
        properties: {
          image: 'redis:7-alpine'
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
          ports: [
            {
              port: 6379
              protocol: 'TCP'
            }
          ]
          command: [
            'redis-server'
            '--appendonly'
            'yes'
            '--maxmemory'
            '512mb'
            '--maxmemory-policy'
            'allkeys-lru'
          ]
          volumeMounts: [
            {
              name: 'redisdata'
              mountPath: '/data'
            }
          ]
        }
      }
    ]
    volumes: [
      {
        name: 'redisdata'
        azureFile: {
          shareName: redisFileShareName
          storageAccountName: storageAccountName
          storageAccountKey: storageAccountKey
        }
      }
    ]
  }
}

output fqdn string = aciRedis.properties.ipAddress.ip
output name string = aciRedis.name
