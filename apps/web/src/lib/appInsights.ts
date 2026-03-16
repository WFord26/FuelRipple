/**
 * Azure Application Insights initializer for the FuelRipple web app.
 *
 * Usage:
 *  - Import `appInsights` to manually track events/exceptions.
 *  - Import `AppInsightsContext` to wrap the React tree (done in main.tsx).
 *  - Import `useTrackEvent` / `useTrackException` hooks from `useAnalytics`.
 */

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

// Injected by Vite at build time from VITE_APPINSIGHTS_CONNECTION_STRING
const CONNECTION_STRING = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING as string | undefined;

export const reactPlugin = new ReactPlugin();

const ai = new ApplicationInsights({
  config: {
    connectionString: CONNECTION_STRING,
    extensions: [reactPlugin],
    // Auto-collect page views via the React plugin's useHistory integration
    enableAutoRouteTracking: false, // we use usePageTracking hook instead
    // Performance / privacy settings
    disableTelemetry: !CONNECTION_STRING, // no-op in dev if env var is unset
    enableCorsCorrelation: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true,
    // Web Vitals
    enablePerfMgr: true,
    // Do not track the AI endpoint calls themselves
    disableAjaxTracking: false,
    excludeRequestFromAutoTrackingPatterns: [/applicationinsights\.azure\.com/],
    // Session / user
    samplingPercentage: 100,
  },
});

if (CONNECTION_STRING) {
  ai.loadAppInsights();
}

export const appInsights = ai;

/** Convenience: track a named custom event with optional properties/measurements. */
export function trackEvent(
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>,
) {
  if (!CONNECTION_STRING) return;
  ai.trackEvent({ name, properties, measurements });
}

/** Convenience: track an exception. */
export function trackException(error: Error, properties?: Record<string, string>) {
  if (!CONNECTION_STRING) return;
  ai.trackException({ exception: error, properties });
}

/** Convenience: track a manual page view. */
export function trackPageView(name: string, uri?: string) {
  if (!CONNECTION_STRING) return;
  ai.trackPageView({ name, uri });
}
