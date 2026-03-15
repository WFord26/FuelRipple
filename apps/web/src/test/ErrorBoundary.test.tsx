import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from './test-utils';
import ErrorBoundary from '../components/ErrorBoundary';

const ThrowingComponent = ({ error }: { error?: Error }) => {
  if (error) throw error;
  return <div>Child content</div>;
};

describe('ErrorBoundary', () => {
  // Suppress error boundary console.error noise during tests
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary section="Test">
        <div>Hello World</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders full error UI when child throws', () => {
    render(
      <ErrorBoundary section="Dashboard">
        <ThrowingComponent error={new Error('Test error')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('renders inline error UI when inline=true', () => {
    render(
      <ErrorBoundary section="Widget" inline={true}>
        <ThrowingComponent error={new Error('Widget error')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Widget failed to load')).toBeInTheDocument();
    expect(screen.getByText('Widget error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('recovers after clicking Try again', async () => {
    const { createTestUser } = await import('./test-utils');
    const user = createTestUser();
    let shouldThrow = true;

    const ConditionalThrower = () => {
      if (shouldThrow) throw new Error('boom');
      return <div>Recovered!</div>;
    };

    render(
      <ErrorBoundary section="Test">
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Stop throwing before clicking retry
    shouldThrow = false;
    const retryButton = screen.getByText('Try again');
    await user.click(retryButton);

    expect(screen.getByText('Recovered!')).toBeInTheDocument();
  });
});
