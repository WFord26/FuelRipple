import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from './test-utils';
import App from '../App';

// Suppress console.error from Error Boundary during tests
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('App', () => {
  it('renders without crashing', async () => {
    render(<App />);
    // Wait for lazy-loaded Dashboard to appear (or at least the loading skeleton)
    await waitFor(() => {
      const brand = screen.getAllByText(/Fuel|Ripple/);
      expect(brand.length).toBeGreaterThan(0);
    });
  });

  it('renders navigation layout', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
    });
  });
});
