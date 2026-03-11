import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Wrapper component that provides context/providers needed for tests
 */
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

/**
 * Custom render function that includes common providers
 */
const render = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  rtlRender(ui, { wrapper: AllTheProviders, ...options });

/**
 * Helper to create a test user with common actions
 */
export const createTestUser = () => userEvent.setup();

export * from '@testing-library/react';
export { render, userEvent };
