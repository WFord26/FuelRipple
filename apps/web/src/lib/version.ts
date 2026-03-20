/**
 * Frontend application version
 * Injected at build time by Vite from package.json
 */

declare const __APP_VERSION__: string;

export function getAppVersion(): string {
  try {
    return __APP_VERSION__ || 'dev';
  } catch (error) {
    return 'dev';
  }
}
