// ================================================================
// FuelRipple — Azure Monitor Alerts & Action Groups
// ================================================================

@description('Suffix used for all resource names (e.g. fuelripple-dev)')
param suffix string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Email address(es) for alert notifications (comma-separated)')
param alertEmails string

@description('Resource ID of the Application Insights component to monitor')
param appInsightsResourceId string

@description('Optional webhook URL for alert notifications (e.g., Slack, Teams)')
param webhookUrl string = ''

// ── Action Group (Alert Destination) ────────────────────────────────────────
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-${suffix}'
  location: 'global'
  properties: {
    groupShortName: substring('FR-${suffix}', 0, 12) // Max 12 chars
    enabled: true
    emailReceivers: [for email in split(alertEmails, ','): {
      name: 'email-${uniqueString(email)}'
      emailAddress: trim(email)
      useCommonAlertSchema: true
    }]
    webhookReceivers: webhookUrl != '' ? [
      {
        name: 'webhook-notification'
        serviceUri: webhookUrl
        useCommonAlertSchema: true
      }
    ] : []
  }
}

// ── Alert: Job Failures ──────────────────────────────────────────────────────
// Triggers when job exceptions are tracked in Application Insights
resource jobFailureAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-job-failures-${suffix}'
  location: 'global'
  properties: {
    description: 'Alert when data ingestion jobs fail (tracked via trackApiException with jobName property)'
    severity: 2 // Warning
    enabled: true
    scopes: [
      appInsightsResourceId
    ]
    evaluationFrequency: 'PT5M' // Check every 5 minutes
    windowSize: 'PT15M' // Look back 15 minutes
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ExceptionCount'
          metricName: 'exceptions/count'
          operator: 'GreaterThan'
          threshold: 0 // Any exception in a 15-min window
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// ── Alert: High API Error Rate ───────────────────────────────────────────────
// Triggers when server errors (5xx) exceed threshold
resource apiErrorAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-api-errors-${suffix}'
  location: 'global'
  properties: {
    description: 'Alert when API returns excessive 5xx errors'
    severity: 1 // Error
    enabled: true
    scopes: [
      appInsightsResourceId
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ServerErrors'
          metricName: 'requests/failed'
          operator: 'GreaterThan'
          threshold: 10 // More than 10 failed requests in 15 min
          timeAggregation: 'Total'
          dimensions: [
            {
              name: 'request/resultCode'
              operator: 'Include'
              values: [
                '500'
                '502'
                '503'
                '504'
                '505'
              ]
            }
          ]
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// ── Alert: App Service Down ──────────────────────────────────────────────────
// Triggers when health check fails or no telemetry received
resource appDownAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-app-down-${suffix}'
  location: 'global'
  properties: {
    description: 'Alert when API stops responding (no telemetry received)'
    severity: 0 // Critical
    enabled: true
    scopes: [
      appInsightsResourceId
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'NoRequests'
          metricName: 'requests/count'
          operator: 'LessThan'
          threshold: 1 // No requests in 15 min (app likely down)
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// ── Outputs ──────────────────────────────────────────────────────────────────
output actionGroupId string = actionGroup.id
output actionGroupName string = actionGroup.name
