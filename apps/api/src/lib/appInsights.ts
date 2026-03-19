/**
 * Azure Application Insights server-side initializer.
 *
 * MUST be imported and `start()` called BEFORE any other require/import
 * in apps/api/src/index.ts so that the SDK can monkey-patch built-in
 * modules (http, https) for automatic dependency tracking.
 *
 * Tracked automatically:
 *  - Incoming HTTP requests (routes, status codes, duration)
 *  - Outgoing HTTP/HTTPS dependencies (EIA, FRED, AAA, BullMQ jobs)
 *  - Unhandled exceptions and promise rejections
 *  - Console.error calls (mapped to traces)
 *
 * Use `trackEvent / trackException / trackMetric` for manual telemetry.
 */

import * as appInsightsModule from 'applicationinsights';

let started = false;

export function initAppInsights(): void {
  // Read after dotenv.config() has run
  const CONNECTION_STRING = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!CONNECTION_STRING) {
    console.log('ℹ️  Application Insights: APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled');
    return;
  }
  if (started) return;

  appInsightsModule
    .setup(CONNECTION_STRING)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setAutoDependencyCorrelation(true)
    .setUseDiskRetryCaching(false)
    .setSendLiveMetrics(false)
    .start();

  const client = appInsightsModule.defaultClient;

  // Tag all telemetry with the service name and environment
  client.context.tags[client.context.keys.cloudRole] = 'fuelripple-api';
  client.context.tags[client.context.keys.cloudRoleInstance] =
    process.env.NODE_ENV ?? 'development';

  started = true;
  console.log('📊 Application Insights telemetry active');
}

/** Track a custom business event from route handlers or services. */
export function trackApiEvent(
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>,
): void {
  if (!started) return;
  appInsightsModule.defaultClient.trackEvent({ name, properties, measurements });
}

/** Track an exception with optional context properties. */
export function trackApiException(
  error: Error,
  properties?: Record<string, string>,
): void {
  if (!started) return;
  appInsightsModule.defaultClient.trackException({ exception: error, properties });
}

/** Track a numeric metric (e.g. cache hit rate, price update duration). */
export function trackMetric(name: string, value: number): void {
  if (!started) return;
  appInsightsModule.defaultClient.trackMetric({ name, value });
}
