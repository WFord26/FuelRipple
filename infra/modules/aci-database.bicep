// TimescaleDB Container Instance (PostgreSQL 16 + TimescaleDB)
param suffix string
param location string

@secure()
param dbPassword string
param subnetId string
param storageAccountName string

@secure()
param storageAccountKey string
param pgFileShareName string

resource aciDb 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: 'aci-db-${suffix}'
  location: location
  properties: {
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Private'
      ports: [
        {
          port: 5432
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
        name: 'timescaledb'
        properties: {
          image: 'timescale/timescaledb:latest-pg16'
          resources: {
            requests: {
              cpu: 2
              memoryInGB: 4
            }
          }
          ports: [
            {
              port: 5432
              protocol: 'TCP'
            }
          ]
          environmentVariables: [
            {
              name: 'POSTGRES_DB'
              value: 'gastracker'
            }
            {
              name: 'POSTGRES_USER'
              value: 'fuelripple'
            }
            {
              name: 'POSTGRES_PASSWORD'
              secureValue: dbPassword
            }
          ]
          command: [
            'postgres'
            '-c'
            'shared_preload_libraries=timescaledb'
            '-c'
            'max_connections=100'
            '-c'
            'shared_buffers=1GB'
            '-c'
            'work_mem=16MB'
          ]
          volumeMounts: [
            {
              name: 'pgdata'
              mountPath: '/var/lib/postgresql/data'
            }
          ]
        }
      }
    ]
    volumes: [
      {
        name: 'pgdata'
        azureFile: {
          shareName: pgFileShareName
          storageAccountName: storageAccountName
          storageAccountKey: storageAccountKey
        }
      }
    ]
  }
}

output fqdn string = aciDb.properties.ipAddress.ip
output name string = aciDb.name
