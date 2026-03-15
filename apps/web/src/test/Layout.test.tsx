import { describe, it, expect } from 'vitest';
import { render, screen } from './test-utils';
import Layout from '../components/Layout';

describe('Layout component', () => {
  it('renders the FuelRipple brand name', () => {
    render(<Layout />);
    expect(screen.getByText('Fuel')).toBeInTheDocument();
    expect(screen.getByText('Ripple')).toBeInTheDocument();
  });

  it('renders all desktop navigation links', () => {
    render(<Layout />);
    const navLinks = ['Dashboard', 'Historical', 'Regional', 'Supply', 'Impact', 'Correlation', 'Downstream'];
    for (const name of navLinks) {
      // Multiple instances due to desktop + mobile nav; check at least one exists
      const links = screen.getAllByText(name);
      expect(links.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders the footer', () => {
    render(<Layout />);
    expect(screen.getByText(/Data sources/)).toBeInTheDocument();
    expect(screen.getByText(/EIA, FRED/)).toBeInTheDocument();
  });

  it('renders the hamburger button for mobile', () => {
    render(<Layout />);
    const button = screen.getByLabelText('Open menu');
    expect(button).toBeInTheDocument();
  });

  it('shows mobile nav after clicking hamburger', async () => {
    const { createTestUser } = await import('./test-utils');
    const user = createTestUser();
    render(<Layout />);

    const button = screen.getByLabelText('Open menu');
    await user.click(button);

    // After clicking, close menu button should be visible
    const closeButton = screen.getByLabelText('Close menu');
    expect(closeButton).toBeInTheDocument();
  });

  it('renders GitHub link in footer', () => {
    render(<Layout />);
    const githubLink = screen.getByText('GitHub');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/WFord26/FuelRipple');
    expect(githubLink).toHaveAttribute('target', '_blank');
  });
});
